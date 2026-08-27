import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { TenancyService } from '../../tenancy/application/tenancy.service';

const prInclude = {
  lines: { orderBy: { lineNo: 'asc' as const } },
  purchaseOrders: {
    select: {
      id: true,
      number: true,
      status: true,
      title: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PurchaseRequestInclude;

@Injectable()
export class PurchaseRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenancy: TenancyService,
  ) {}

  list(tenantId: string) {
    return this.prisma.purchaseRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: prInclude,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: { id, tenantId },
      include: prInclude,
    });
    if (!row) throw new NotFoundException('Purchase request not found');
    return row;
  }

  async create(
    tenantId: string,
    actorId: string,
    input: {
      number: string;
      title: string;
      entityId?: string;
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
      const row = await this.prisma.purchaseRequest.create({
        data: {
          tenantId,
          number: input.number.trim(),
          title: input.title.trim(),
          entityId: input.entityId,
          requesterId: actorId,
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
        include: prInclude,
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'pr.created',
        entityType: 'PurchaseRequest',
        entityId: row.id,
        meta: { number: row.number },
      });
      return row;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('PR number already exists');
      }
      throw err;
    }
  }

  async transition(
    tenantId: string,
    id: string,
    actorId: string,
    status: PurchaseRequestStatus,
  ) {
    const existing = await this.get(tenantId, id);
    if (status === 'converted') {
      throw new BadRequestException(
        'Use convert endpoint to convert an approved PR to a PO',
      );
    }
    const allowed: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
      draft: ['in_approval', 'cancelled'],
      in_approval: ['approved', 'draft', 'cancelled'],
      approved: ['cancelled'],
      converted: [],
      cancelled: [],
    };
    if (!allowed[existing.status].includes(status)) {
      throw new BadRequestException(
        `Cannot move PR from ${existing.status} to ${status}`,
      );
    }
    const row = await this.prisma.purchaseRequest.update({
      where: { id },
      data: { status },
      include: prInclude,
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'pr.status',
      entityType: 'PurchaseRequest',
      entityId: id,
      meta: { from: existing.status, to: status },
    });
    return row;
  }

  /**
   * Convert an approved PR into a draft PO with line carry-over.
   * Requires both purchase_requests (route guard) and purchase_orders licenses.
   */
  async convertToPo(
    tenantId: string,
    id: string,
    actorId: string,
    input: {
      number?: string;
      vendorId?: string;
      contractId?: string;
    } = {},
  ) {
    const poLicensed = await this.tenancy.isModuleEnabled(
      tenantId,
      'purchase_orders',
    );
    if (!poLicensed) {
      throw new ForbiddenException('Module "purchase_orders" is not licensed');
    }

    const pr = await this.get(tenantId, id);
    if (pr.status !== 'approved') {
      throw new BadRequestException(
        `Only approved PRs can be converted (current: ${pr.status})`,
      );
    }
    if (pr.purchaseOrders.length > 0) {
      throw new BadRequestException('PR already has a linked purchase order');
    }

    if (input.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: input.vendorId, tenantId },
        select: { id: true },
      });
      if (!vendor) throw new BadRequestException('Vendor not found');
    }
    if (input.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: input.contractId, tenantId },
        select: { id: true },
      });
      if (!contract) throw new BadRequestException('Contract not found');
    }

    const poNumber = (input.number?.trim() || `PO-${pr.number}`).slice(0, 64);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.create({
          data: {
            tenantId,
            number: poNumber,
            title: pr.title,
            entityId: pr.entityId,
            vendorId: input.vendorId,
            contractId: input.contractId,
            purchaseRequestId: pr.id,
            currency: pr.currency,
            totalMinor: pr.totalMinor,
            notes: pr.notes,
            lines: pr.lines.length
              ? {
                  create: pr.lines.map((line) => ({
                    lineNo: line.lineNo,
                    description: line.description,
                    quantity: line.quantity,
                    unitPriceMinor: line.unitPriceMinor,
                    amountMinor: line.amountMinor,
                    glAccountId: line.glAccountId,
                  })),
                }
              : undefined,
          },
          include: { lines: { orderBy: { lineNo: 'asc' } } },
        });

        await tx.purchaseRequest.update({
          where: { id: pr.id },
          data: { status: 'converted' },
        });

        return po;
      });

      await this.audit.record({
        tenantId,
        actorId,
        action: 'pr.converted',
        entityType: 'PurchaseRequest',
        entityId: pr.id,
        meta: { purchaseOrderId: result.id, poNumber: result.number },
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'po.created',
        entityType: 'PurchaseOrder',
        entityId: result.id,
        meta: { number: result.number, fromPurchaseRequestId: pr.id },
      });

      return {
        purchaseRequest: await this.get(tenantId, pr.id),
        purchaseOrder: result,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `PO number "${poNumber}" already exists — pass a unique number`,
        );
      }
      throw err;
    }
  }
}
