import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { InvoiceValidationService } from '../../invoice-rules/application/invoice-validation.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { UsageService } from '../../usage/application/usage.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly validation: InvoiceValidationService,
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

    const gate = await this.validation.assertReadyForApproval(tenantId, invoiceId);
    if (gate.blocking) {
      throw new BadRequestException(
        `Cannot submit: ${gate.summary}. Fix exceptions and save again.`,
      );
    }

    const ready = await this.prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId, tenantId },
    });
    if (ready.totalMinor == null) {
      throw new BadRequestException('Total amount is required before submit');
    }

    const policy = await this.getPolicy(tenantId);
    const matchedRule = await this.findMatchingRule(
      tenantId,
      ready.entityId,
      ready.totalMinor,
    );

    if (matchedRule?.autoApprove) {
      return this.finalizeApprove(tenantId, invoiceId, actorUserId);
    }

    const underAuto =
      !matchedRule &&
      policy.enabled &&
      policy.autoApproveUnderMinor != null &&
      ready.totalMinor <= policy.autoApproveUnderMinor;

    if (underAuto) {
      return this.finalizeApprove(tenantId, invoiceId, actorUserId);
    }

    const roleFilter = matchedRule?.assigneeRole
      ? [matchedRule.assigneeRole]
      : (['admin', 'approver', 'ap_manager'] as const);

    const assignees = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: [...roleFilter] },
        NOT: { id: actorUserId },
      },
    });
    const fallback = assignees.length
      ? assignees
      : await this.prisma.user.findMany({ where: { tenantId, role: 'admin' } });

    if (fallback.length === 0) {
      // no approver available — auto-approve
      return this.finalizeApprove(tenantId, invoiceId, actorUserId);
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

    await this.notifications.notifyMany(
      fallback.map((user) => ({
        tenantId,
        userId: user.id,
        type: 'approval.assigned',
        title: 'Invoice needs approval',
        body: invoice.invoiceNumber
          ? `Invoice ${invoice.invoiceNumber} is waiting for you.`
          : 'An invoice is waiting for your approval.',
        href: `/invoices/${invoiceId}`,
      })),
    );

    await this.audit.record({
      tenantId,
      actorId: actorUserId,
      action: 'invoice.submitted',
      entityType: 'Invoice',
      entityId: invoiceId,
      meta: matchedRule
        ? { ruleId: matchedRule.id, ruleName: matchedRule.name }
        : { fallback: 'default_policy' },
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

  private async findMatchingRule(
    tenantId: string,
    entityId: string | null,
    totalMinor: number,
  ) {
    const rules = await this.prisma.approvalRule.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return (
      rules.find((rule) => {
        if (rule.entityId && rule.entityId !== entityId) return false;
        if (rule.minMinor != null && totalMinor < rule.minMinor) return false;
        if (rule.maxMinor != null && totalMinor > rule.maxMinor) return false;
        return true;
      }) ?? null
    );
  }

  listRules(tenantId: string) {
    return this.prisma.approvalRule.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  async createRule(
    tenantId: string,
    data: {
      name: string;
      entityId?: string | null;
      minMinor?: number | null;
      maxMinor?: number | null;
      autoApprove?: boolean;
      assigneeRole?: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver' | null;
      priority?: number;
      enabled?: boolean;
    },
  ) {
    if (
      data.minMinor != null &&
      data.maxMinor != null &&
      data.minMinor > data.maxMinor
    ) {
      throw new BadRequestException('minMinor cannot exceed maxMinor');
    }
    if (data.entityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: data.entityId, tenantId },
      });
      if (!entity) throw new BadRequestException('Entity not found');
    }
    return this.prisma.approvalRule.create({
      data: {
        tenantId,
        name: data.name.trim(),
        entityId: data.entityId ?? null,
        minMinor: data.minMinor ?? null,
        maxMinor: data.maxMinor ?? null,
        autoApprove: data.autoApprove ?? false,
        assigneeRole: data.assigneeRole ?? null,
        priority: data.priority ?? 100,
        enabled: data.enabled ?? true,
      },
    });
  }

  async updateRule(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      entityId?: string | null;
      minMinor?: number | null;
      maxMinor?: number | null;
      autoApprove?: boolean;
      assigneeRole?: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver' | null;
      priority?: number;
      enabled?: boolean;
    },
  ) {
    const existing = await this.prisma.approvalRule.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Approval rule not found');
    const minMinor =
      data.minMinor !== undefined ? data.minMinor : existing.minMinor;
    const maxMinor =
      data.maxMinor !== undefined ? data.maxMinor : existing.maxMinor;
    if (minMinor != null && maxMinor != null && minMinor > maxMinor) {
      throw new BadRequestException('minMinor cannot exceed maxMinor');
    }
    if (data.entityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: data.entityId, tenantId },
      });
      if (!entity) throw new BadRequestException('Entity not found');
    }
    return this.prisma.approvalRule.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        entityId: data.entityId,
        minMinor: data.minMinor,
        maxMinor: data.maxMinor,
        autoApprove: data.autoApprove,
        assigneeRole: data.assigneeRole,
        priority: data.priority,
        enabled: data.enabled,
      },
    });
  }

  async deleteRule(tenantId: string, id: string) {
    const existing = await this.prisma.approvalRule.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Approval rule not found');
    await this.prisma.approvalRule.delete({ where: { id } });
    return { ok: true };
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
      const rejected = await this.prisma.invoice.update({
        where: { id: task.invoiceId },
        data: { status: 'needs_review' },
        include: {
          fileAsset: true,
          exceptions: true,
          lines: { orderBy: { lineNo: 'asc' } },
        },
      });
      await this.audit.record({
        tenantId,
        actorId: userId,
        action: 'invoice.rejected',
        entityType: 'Invoice',
        entityId: task.invoiceId,
        meta: { comment: comment ?? null },
      });
      await this.notifications.notifyRoles(tenantId, ['admin', 'ap_manager', 'ap_clerk'], {
        type: 'invoice.rejected',
        title: 'Invoice rejected',
        body: rejected.invoiceNumber
          ? `Invoice ${rejected.invoiceNumber} was sent back for review.`
          : 'An invoice was sent back for review.',
        href: `/invoices/${task.invoiceId}`,
        excludeUserId: userId,
      });
      return rejected;
    }

    // One approval is enough for P0
    await this.prisma.approvalTask.updateMany({
      where: { invoiceId: task.invoiceId, status: 'pending' },
      data: { status: 'approved', comment: 'Closed by peer approval', decidedAt: new Date() },
    });
    return this.finalizeApprove(tenantId, task.invoiceId, userId);
  }

  private async finalizeApprove(
    tenantId: string,
    invoiceId: string,
    actorId?: string,
  ) {
    const usage = await this.usage.getUsageSummary(tenantId);
    if (usage.hardBlocked) {
      throw new BadRequestException(
        `Approved invoice hard limit reached (${usage.approvedHardLimit} MTD)`,
      );
    }

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
    await this.audit.record({
      tenantId,
      actorId,
      action: 'invoice.approved',
      entityType: 'Invoice',
      entityId: invoiceId,
    });
    await this.notifications.notifyRoles(tenantId, ['admin', 'ap_manager'], {
      type: 'invoice.approved',
      title: 'Invoice approved',
      body: updated.invoiceNumber
        ? `Invoice ${updated.invoiceNumber} is payment-ready.`
        : 'An invoice was approved.',
      href: `/invoices/${invoiceId}`,
      excludeUserId: actorId,
    });
    return updated;
  }
}
