import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApAccrualStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { ACCRUAL_APPROVAL_CHAIN } from '../../contracts/application/procure-constants';

const accrualInclude = {
  purchaseOrder: {
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      totalMinor: true,
      currency: true,
      vendorId: true,
      contractId: true,
    },
  },
  contract: {
    select: { id: true, number: true, title: true },
  },
} satisfies Prisma.ApAccrualInclude;

@Injectable()
export class AccrualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listAccruals(tenantId: string, opts?: { status?: ApAccrualStatus }) {
    return this.prisma.apAccrual.findMany({
      where: {
        tenantId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      include: accrualInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.apAccrual.findFirst({
      where: { id, tenantId },
      include: accrualInclude,
    });
    if (!row) throw new NotFoundException('Accrual not found');
    return row;
  }

  /**
   * For open POs (issued / partially_received / received) with remaining
   * uninvoiced amount, create or update a draft accrual.
   */
  async generateFromOpenPos(tenantId: string, actorId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: ['issued', 'partially_received', 'received'] },
      },
      include: {
        invoices: { select: { totalMinor: true } },
        purchaseRequest: {
          select: { department: true, category: true },
        },
      },
      take: 500,
    });

    const vendorIds = [
      ...new Set(pos.map((p) => p.vendorId).filter(Boolean) as string[]),
    ];
    const vendors = vendorIds.length
      ? await this.prisma.vendor.findMany({
          where: { tenantId, id: { in: vendorIds } },
          select: { id: true, name: true },
        })
      : [];
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]));

    const results: Awaited<ReturnType<typeof this.get>>[] = [];

    for (const po of pos) {
      const invoicedMinor = po.invoices.reduce(
        (sum, inv) => sum + (inv.totalMinor ?? 0),
        0,
      );
      const remainingMinor = Math.max(0, (po.totalMinor ?? 0) - invoicedMinor);
      if (remainingMinor <= 0) continue;

      const existing = await this.prisma.apAccrual.findFirst({
        where: {
          tenantId,
          purchaseOrderId: po.id,
          status: 'draft',
        },
      });

      const data = {
        amountMinor: remainingMinor,
        currency: po.currency,
        contractId: po.contractId,
        entityId: po.entityId,
        vendorName: po.vendorId
          ? vendorNameById.get(po.vendorId) ?? null
          : null,
        department: po.purchaseRequest?.department ?? null,
        category: po.purchaseRequest?.category ?? null,
      };

      let accrualId: string;
      if (existing) {
        await this.prisma.apAccrual.update({
          where: { id: existing.id },
          data,
        });
        accrualId = existing.id;
      } else {
        const created = await this.prisma.apAccrual.create({
          data: {
            tenantId,
            purchaseOrderId: po.id,
            status: 'draft',
            approvalStage: 0,
            ...data,
          },
        });
        accrualId = created.id;
      }
      results.push(await this.get(tenantId, accrualId));
    }

    await this.audit.record({
      tenantId,
      actorId,
      action: 'accrual.generated_from_pos',
      entityType: 'ApAccrual',
      entityId: results[0]?.id ?? tenantId,
      meta: { count: results.length },
    });

    return results;
  }

  async sendForApproval(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'draft') {
      throw new BadRequestException(
        'Only draft accruals can be sent for approval',
      );
    }
    await this.prisma.apAccrual.update({
      where: { id },
      data: { status: 'in_approval', approvalStage: 1 },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'accrual.send_for_approval',
      entityType: 'ApAccrual',
      entityId: id,
      meta: { approvalStage: 1 },
    });
    return this.get(tenantId, id);
  }

  async advanceApproval(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'in_approval') {
      throw new BadRequestException(
        'Only accruals in approval can be advanced',
      );
    }
    const nextStage = existing.approvalStage + 1;
    if (nextStage > ACCRUAL_APPROVAL_CHAIN.length) {
      await this.prisma.apAccrual.update({
        where: { id },
        data: {
          status: 'approved',
          approvalStage: ACCRUAL_APPROVAL_CHAIN.length,
        },
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'accrual.advance_approval',
        entityType: 'ApAccrual',
        entityId: id,
        meta: { to: 'approved' },
      });
    } else {
      await this.prisma.apAccrual.update({
        where: { id },
        data: { approvalStage: nextStage },
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'accrual.advance_approval',
        entityType: 'ApAccrual',
        entityId: id,
        meta: {
          approvalStage: nextStage,
          stageName: ACCRUAL_APPROVAL_CHAIN[nextStage - 1],
        },
      });
    }
    return this.get(tenantId, id);
  }

  async postToErp(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'approved') {
      throw new BadRequestException(
        'Only approved accruals can be posted to ERP',
      );
    }
    await this.prisma.apAccrual.update({
      where: { id },
      data: { status: 'posted' },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'accrual.posted',
      entityType: 'ApAccrual',
      entityId: id,
      meta: { mock: true },
    });
    return this.get(tenantId, id);
  }
}
