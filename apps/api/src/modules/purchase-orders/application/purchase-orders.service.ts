import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Purchase order not found');
    return row;
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
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'po.created',
        entityType: 'PurchaseOrder',
        entityId: row.id,
        meta: { number: row.number },
      });
      return row;
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
      issued: ['partially_received', 'received', 'cancelled'],
      partially_received: ['received', 'cancelled'],
      received: ['closed'],
      closed: [],
      cancelled: [],
    };
    if (!allowed[existing.status].includes(status)) {
      throw new BadRequestException(
        `Cannot move PO from ${existing.status} to ${status}`,
      );
    }
    const row = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        ...(status === 'issued' ? { issuedAt: new Date() } : {}),
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'po.status',
      entityType: 'PurchaseOrder',
      entityId: id,
      meta: { from: existing.status, to: status },
    });
    return row;
  }
}
