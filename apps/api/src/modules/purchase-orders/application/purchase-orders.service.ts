import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';

const poInclude = {
  lines: { orderBy: { lineNo: 'asc' as const } },
  purchaseRequest: {
    select: { id: true, number: true, title: true, status: true },
  },
  invoices: {
    select: { id: true, totalMinor: true, status: true, invoiceNumber: true },
  },
} satisfies Prisma.PurchaseOrderInclude;

type PoWithInvoices = Prisma.PurchaseOrderGetPayload<{
  include: typeof poInclude;
}>;

function withInvoiceTotals<T extends PoWithInvoices>(row: T) {
  const invoicedMinor = row.invoices.reduce(
    (sum, inv) => sum + (inv.totalMinor ?? 0),
    0,
  );
  const remainingMinor = Math.max(0, (row.totalMinor ?? 0) - invoicedMinor);
  return { ...row, invoicedMinor, remainingMinor };
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: poInclude,
    });
    return rows.map(withInvoiceTotals);
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: poInclude,
    });
    if (!row) throw new NotFoundException('Purchase order not found');
    return withInvoiceTotals(row);
  }

  async create(
    tenantId: string,
    actorId: string,
    input: {
      number: string;
      title: string;
      vendorId?: string;
      entityId?: string;
      contractId?: string;
      purchaseRequestId?: string;
      currency?: string;
      totalMinor?: number;
      notes?: string;
      lines?: {
        description?: string;
        quantity?: number;
        unitPriceMinor?: number;
        amountMinor?: number;
      }[];
    },
  ) {
    try {
      const row = await this.prisma.purchaseOrder.create({
        data: {
          tenantId,
          number: input.number.trim(),
          title: input.title.trim(),
          vendorId: input.vendorId,
          entityId: input.entityId,
          contractId: input.contractId,
          purchaseRequestId: input.purchaseRequestId,
          currency: input.currency ?? 'EUR',
          totalMinor: input.totalMinor,
          notes: input.notes,
          lines: input.lines?.length
            ? {
                create: input.lines.map((line, idx) => ({
                  lineNo: idx + 1,
                  description: line.description,
                  quantity: line.quantity,
                  unitPriceMinor: line.unitPriceMinor,
                  amountMinor: line.amountMinor,
                })),
              }
            : undefined,
        },
        include: poInclude,
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'po.created',
        entityType: 'PurchaseOrder',
        entityId: row.id,
        meta: { number: row.number },
      });
      return withInvoiceTotals(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('PO number already exists');
      }
      throw err;
    }
  }

  async transition(
    tenantId: string,
    id: string,
    actorId: string,
    status: PurchaseOrderStatus,
  ) {
    const existing = await this.get(tenantId, id);
    const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      draft: ['issued', 'cancelled'],
      issued: ['cancelled'],
      partially_received: ['cancelled'],
      received: ['closed'],
      closed: [],
      cancelled: [],
    };
    if (!allowed[existing.status].includes(status)) {
      throw new BadRequestException(
        `Cannot move PO from ${existing.status} to ${status}. Use receive for goods receipt.`,
      );
    }
    const row = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        ...(status === 'issued' ? { issuedAt: new Date() } : {}),
      },
      include: poInclude,
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'po.status',
      entityType: 'PurchaseOrder',
      entityId: id,
      meta: { from: existing.status, to: status },
    });
    return withInvoiceTotals(row);
  }

  /**
   * Receive against PO lines. Partial receive updates status to partially_received;
   * full receive → received. Body lines optional — omit to receive all remaining qty.
   */
  async receive(
    tenantId: string,
    id: string,
    actorId: string,
    input: {
      lines?: { lineNo: number; quantity: number }[];
    } = {},
  ) {
    const po = await this.get(tenantId, id);
    if (po.status !== 'issued' && po.status !== 'partially_received') {
      throw new BadRequestException(
        `Cannot receive against PO in status ${po.status}`,
      );
    }
    if (po.lines.length === 0) {
      const row = await this.prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'received' },
        include: poInclude,
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'po.received',
        entityType: 'PurchaseOrder',
        entityId: id,
        meta: { mode: 'empty_lines' },
      });
      return withInvoiceTotals(row);
    }

    const receipts: { lineNo: number; quantity: number }[] =
      input.lines?.length
        ? input.lines
        : po.lines.map((line) => {
            const ordered = line.quantity ?? 0;
            const already = line.receivedQty ?? 0;
            return {
              lineNo: line.lineNo,
              quantity: Math.max(0, ordered - already),
            };
          }).filter((r) => r.quantity > 0);

    if (receipts.length === 0) {
      throw new BadRequestException('Nothing left to receive');
    }

    const byLine = new Map(po.lines.map((l) => [l.lineNo, l]));
    const updates: { id: string; receivedQty: number; lineNo: number; qty: number }[] =
      [];

    for (const receipt of receipts) {
      if (!(receipt.quantity > 0)) {
        throw new BadRequestException('Receive quantity must be positive');
      }
      const line = byLine.get(receipt.lineNo);
      if (!line) {
        throw new BadRequestException(`Unknown lineNo ${receipt.lineNo}`);
      }
      const ordered = line.quantity;
      if (ordered == null) {
        throw new BadRequestException(
          `Line ${receipt.lineNo} has no ordered quantity`,
        );
      }
      const already = line.receivedQty ?? 0;
      const next = already + receipt.quantity;
      if (next > ordered + 1e-9) {
        throw new BadRequestException(
          `Line ${receipt.lineNo}: cannot receive ${receipt.quantity} (ordered ${ordered}, already ${already})`,
        );
      }
      updates.push({
        id: line.id,
        receivedQty: next,
        lineNo: line.lineNo,
        qty: receipt.quantity,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.purchaseOrderLine.update({
          where: { id: u.id },
          data: { receivedQty: u.receivedQty },
        });
      }
    });

    const refreshed = await this.get(tenantId, id);
    const status = this.deriveReceiveStatus(refreshed.lines);
    let row = refreshed;
    if (status !== refreshed.status) {
      const updated = await this.prisma.purchaseOrder.update({
        where: { id },
        data: { status },
        include: poInclude,
      });
      row = withInvoiceTotals(updated);
    }

    await this.audit.record({
      tenantId,
      actorId,
      action: 'po.received',
      entityType: 'PurchaseOrder',
      entityId: id,
      meta: {
        lines: updates.map((u) => ({
          lineNo: u.lineNo,
          quantity: u.qty,
          receivedQty: u.receivedQty,
        })),
        status: row.status,
      },
    });
    return row;
  }

  private deriveReceiveStatus(
    lines: { quantity: number | null; receivedQty: number | null }[],
  ): PurchaseOrderStatus {
    const withQty = lines.filter((l) => l.quantity != null && l.quantity > 0);
    if (withQty.length === 0) return 'received';
    const allDone = withQty.every(
      (l) => (l.receivedQty ?? 0) >= (l.quantity as number) - 1e-9,
    );
    if (allDone) return 'received';
    const any = withQty.some((l) => (l.receivedQty ?? 0) > 0);
    return any ? 'partially_received' : 'issued';
  }
}
