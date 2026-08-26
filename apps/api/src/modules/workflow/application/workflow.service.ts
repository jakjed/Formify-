import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UsageService } from '../../usage/application/usage.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  async getPolicy(tenantId: string) {
    let policy = await this.prisma.approvalPolicy.findUnique({
      where: { tenantId },
    });
    if (!policy) {
      policy = await this.prisma.approvalPolicy.create({
        data: {
          tenantId,
          name: 'Default invoice policy',
          enabled: true,
          autoApproveUnderMinor: 10000,
        },
      });
    }
    return policy;
  }

  async updatePolicy(
    tenantId: string,
    data: { name?: string; enabled?: boolean; autoApproveUnderMinor?: number | null },
  ) {
    await this.getPolicy(tenantId);
    return this.prisma.approvalPolicy.update({
      where: { tenantId },
      data: {
        name: data.name,
        enabled: data.enabled,
        autoApproveUnderMinor: data.autoApproveUnderMinor,
      },
    });
  }

  async submitInvoice(tenantId: string, invoiceId: string, actorUserId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['needs_review', 'exception', 'captured', 'in_approval'].includes(invoice.status)) {
      throw new BadRequestException(`Cannot submit invoice in status ${invoice.status}`);
    }
    if (invoice.totalMinor == null) {
      throw new BadRequestException('Total amount is required before submit');
    }
    if (!invoice.invoiceNumber) {
      throw new BadRequestException('Invoice number is required before submit');
    }

    const policy = await this.getPolicy(tenantId);
    const underAuto =
      policy.enabled &&
      policy.autoApproveUnderMinor != null &&
      invoice.totalMinor <= policy.autoApproveUnderMinor;

    if (underAuto) {
      return this.finalizeApprove(tenantId, invoiceId);
    }

    const assignees = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['admin', 'approver', 'ap_manager'] },
        NOT: { id: actorUserId },
      },
    });
    const fallback = assignees.length
      ? assignees
      : await this.prisma.user.findMany({ where: { tenantId, role: 'admin' } });

    if (fallback.length === 0) {
      // no approver available — auto-approve
      return this.finalizeApprove(tenantId, invoiceId);
    }

    await this.prisma.approvalTask.updateMany({
      where: { invoiceId, status: 'pending' },
      data: { status: 'rejected', comment: 'Superseded by resubmit', decidedAt: new Date() },
    });

    await this.prisma.approvalTask.createMany({
      data: fallback.map((user) => ({
        tenantId,
        invoiceId,
        assigneeId: user.id,
      })),
    });

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'in_approval' },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  async myWork(tenantId: string, userId: string) {
    const tasks = await this.prisma.approvalTask.findMany({
      where: { tenantId, assigneeId: userId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    const invoiceIds = tasks.map((t) => t.invoiceId);
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, id: { in: invoiceIds } },
      include: { exceptions: { where: { resolved: false } } },
    });
    const byId = new Map(invoices.map((i) => [i.id, i]));
    return tasks.map((task) => ({
      ...task,
      invoice: byId.get(task.invoiceId) ?? null,
    }));
  }

  async decideTask(
    tenantId: string,
    taskId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ) {
    const task = await this.prisma.approvalTask.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task) throw new NotFoundException('Approval task not found');
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Not your approval task');
    }
    if (task.status !== 'pending') {
      throw new BadRequestException('Task already decided');
    }

    await this.prisma.approvalTask.update({
      where: { id: taskId },
      data: {
        status: decision,
        comment,
        decidedAt: new Date(),
      },
    });

    if (decision === 'rejected') {
      await this.prisma.approvalTask.updateMany({
        where: { invoiceId: task.invoiceId, status: 'pending' },
        data: { status: 'rejected', comment: 'Rejected by peer', decidedAt: new Date() },
      });
      return this.prisma.invoice.update({
        where: { id: task.invoiceId },
        data: { status: 'needs_review' },
        include: {
          fileAsset: true,
          exceptions: true,
          lines: { orderBy: { lineNo: 'asc' } },
        },
      });
    }

    // One approval is enough for P0
    await this.prisma.approvalTask.updateMany({
      where: { invoiceId: task.invoiceId, status: 'pending' },
      data: { status: 'approved', comment: 'Closed by peer approval', decidedAt: new Date() },
    });
    return this.finalizeApprove(tenantId, task.invoiceId);
  }

  private async finalizeApprove(tenantId: string, invoiceId: string) {
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        exceptions: {
          updateMany: {
            where: { resolved: false },
            data: { resolved: true },
          },
        },
      },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    await this.usage.recordInvoiceApproved(tenantId, invoiceId);
    return updated;
  }
}
