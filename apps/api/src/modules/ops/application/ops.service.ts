import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommandCenter(tenantId: string, userId: string) {
    const [
      invoiceGroups,
      invoiceExceptions,
      exportBacklog,
      contractGroups,
      prGroups,
      poGroups,
      poRows,
      accrualGroups,
      invoiceTasks,
    ] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.invoiceException.count({
        where: { resolved: false, invoice: { tenantId } },
      }),
      this.prisma.invoice.count({
        where: { tenantId, status: 'approved' },
      }),
      this.prisma.contract.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.purchaseRequest.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          status: { in: ['draft', 'issued', 'partially_received'] },
        },
        select: {
          totalMinor: true,
          invoices: { select: { totalMinor: true } },
        },
      }),
      this.prisma.apAccrual.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.approvalTask.count({
        where: { tenantId, assigneeId: userId, status: 'pending' },
      }),
    ]);

    const inv: Record<string, number> = Object.fromEntries(
      invoiceGroups.map((r) => [r.status, r._count._all]),
    );
    const contracts: Record<string, number> = Object.fromEntries(
      contractGroups.map((r) => [r.status, r._count._all]),
    );
    const prs: Record<string, number> = Object.fromEntries(
      prGroups.map((r) => [r.status, r._count._all]),
    );
    const pos: Record<string, number> = Object.fromEntries(
      poGroups.map((r) => [r.status, r._count._all]),
    );
    const accruals: Record<string, number> = Object.fromEntries(
      accrualGroups.map((r) => [r.status, r._count._all]),
    );

    const remainingMinorSum = poRows.reduce((sum, po) => {
      const invoiced = po.invoices.reduce(
        (s, invRow) => s + (invRow.totalMinor ?? 0),
        0,
      );
      return sum + Math.max(0, (po.totalMinor ?? 0) - invoiced);
    }, 0);

    return {
      invoices: {
        needsReview: inv.needs_review ?? 0,
        exceptions: invoiceExceptions,
        inApproval: inv.in_approval ?? 0,
        exportBacklog,
      },
      contracts: {
        draft: contracts.draft ?? 0,
        inApproval: contracts.in_approval ?? 0,
        pendingSignature: contracts.pending_signature ?? 0,
        active: contracts.active ?? 0,
      },
      purchaseRequests: {
        draft: prs.draft ?? 0,
        inApproval: prs.in_approval ?? 0,
        approved: prs.approved ?? 0,
      },
      purchaseOrders: {
        draft: pos.draft ?? 0,
        issued: pos.issued ?? 0,
        remainingMinorSum,
      },
      accruals: {
        draft: accruals.draft ?? 0,
        inApproval: accruals.in_approval ?? 0,
        approved: accruals.approved ?? 0,
      },
      myApprovals: {
        invoiceTasks,
        contractsInApproval: contracts.in_approval ?? 0,
        prsInApproval: prs.in_approval ?? 0,
        accrualsInApproval: accruals.in_approval ?? 0,
      },
    };
  }
}
