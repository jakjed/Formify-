import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { InvoiceValidationService } from '../../invoice-rules/application/invoice-validation.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { UsageService } from '../../usage/application/usage.service';
import {
  ACCRUAL_APPROVAL_CHAIN,
  CONTRACT_APPROVAL_CHAIN,
} from '../../contracts/application/procure-constants';

const DEFAULT_MODULE_POLICIES: Record<
  string,
  {
    name: string;
    enabled: boolean;
    autoApproveUnderMinor?: number | null;
    chainJson?: string[];
  }
> = {
  invoices: {
    name: 'Default invoice policy',
    enabled: true,
    autoApproveUnderMinor: 10000,
  },
  contracts: {
    name: 'Default contracts policy',
    enabled: true,
    chainJson: [...CONTRACT_APPROVAL_CHAIN],
  },
  purchase_requests: {
    name: 'Default purchase request policy',
    enabled: true,
    chainJson: ['Budget Owner', 'Finance', 'CFO'],
  },
  purchase_orders: {
    name: 'Default purchase order policy',
    enabled: true,
    chainJson: ['AP Manager'],
  },
  accruals: {
    name: 'Default accruals policy',
    enabled: true,
    chainJson: [...ACCRUAL_APPROVAL_CHAIN],
  },
};

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly validation: InvoiceValidationService,
  ) {}

  async getPolicy(tenantId: string, moduleKey = 'invoices') {
    const key = moduleKey.trim() || 'invoices';
    let policy = await this.prisma.approvalPolicy.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
    });
    if (!policy) {
      const defaults: {
        name: string;
        enabled: boolean;
        autoApproveUnderMinor?: number | null;
        chainJson?: string[];
      } = DEFAULT_MODULE_POLICIES[key] ?? {
        name: `Default ${key} policy`,
        enabled: true,
      };
      policy = await this.prisma.approvalPolicy.create({
        data: {
          tenantId,
          moduleKey: key,
          name: defaults.name,
          enabled: defaults.enabled,
          autoApproveUnderMinor: defaults.autoApproveUnderMinor ?? null,
          chainJson: defaults.chainJson
            ? (defaults.chainJson as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }
    return policy;
  }

  /** Ensure default policies exist for known modules (idempotent). */
  async seedModulePolicies(tenantId: string) {
    const results = [];
    for (const moduleKey of Object.keys(DEFAULT_MODULE_POLICIES)) {
      results.push(await this.getPolicy(tenantId, moduleKey));
    }
    return results;
  }

  async updatePolicy(
    tenantId: string,
    data: {
      moduleKey?: string;
      name?: string;
      enabled?: boolean;
      autoApproveUnderMinor?: number | null;
      chainJson?: string[] | null;
    },
  ) {
    const moduleKey = data.moduleKey?.trim() || 'invoices';
    await this.getPolicy(tenantId, moduleKey);
    return this.prisma.approvalPolicy.update({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      data: {
        name: data.name,
        enabled: data.enabled,
        autoApproveUnderMinor: data.autoApproveUnderMinor,
        ...(data.chainJson !== undefined
          ? {
              chainJson:
                data.chainJson === null
                  ? Prisma.JsonNull
                  : (data.chainJson as Prisma.InputJsonValue),
            }
          : {}),
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

    const policy = await this.getPolicy(tenantId, 'invoices');
    const matchedRule = await this.findMatchingRule(
      tenantId,
      ready.entityId,
      ready.totalMinor,
      'invoices',
    );

    if (matchedRule?.autoApprove) {
      return this.finalizeApprove(tenantId, invoiceId, actorUserId, {
        submittedById: actorUserId,
      });
    }

    const underAuto =
      !matchedRule &&
      policy.enabled &&
      policy.autoApproveUnderMinor != null &&
      ready.totalMinor <= policy.autoApproveUnderMinor;

    if (underAuto) {
      return this.finalizeApprove(tenantId, invoiceId, actorUserId, {
        submittedById: actorUserId,
      });
    }

    const submitter = await this.prisma.user.findFirst({
      where: { id: actorUserId, tenantId },
    });
    const sod = await this.listEnabledSod(tenantId);
    const blockOwn = sod.some((p) => p.ruleKey === 'cannot_approve_own_invoice');

    const roleFilter = matchedRule?.assigneeRole
      ? [matchedRule.assigneeRole]
      : (['admin', 'approver', 'ap_manager'] as const);

    let candidates = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: [...roleFilter] },
        status: 'active',
      },
    });

    candidates = this.applySodAssigneeFilter(
      candidates,
      actorUserId,
      submitter?.role ?? null,
      sod,
    );

    if (candidates.length === 0) {
      // Admin fallback, still SoD-filtered
      const admins = await this.prisma.user.findMany({
        where: { tenantId, role: 'admin', status: 'active' },
      });
      candidates = this.applySodAssigneeFilter(
        admins,
        actorUserId,
        submitter?.role ?? null,
        sod,
      );
    }

    if (candidates.length === 0) {
      if (blockOwn) {
        throw new BadRequestException(
          'No eligible approvers after segregation-of-duties rules. Add another approver or adjust SoD policy.',
        );
      }
      return this.finalizeApprove(tenantId, invoiceId, actorUserId, {
        submittedById: actorUserId,
      });
    }

    await this.prisma.approvalTask.updateMany({
      where: { invoiceId, status: 'pending' },
      data: { status: 'rejected', comment: 'Superseded by resubmit', decidedAt: new Date() },
    });

    await this.prisma.approvalTask.createMany({
      data: candidates.map((user) => ({
        tenantId,
        invoiceId,
        assigneeId: user.id,
      })),
    });

    await this.notifications.notifyMany(
      candidates.map((user) => ({
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
      data: { status: 'in_approval', submittedById: actorUserId },
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
    moduleKey = 'invoices',
  ) {
    const rules = await this.prisma.approvalRule.findMany({
      where: { tenantId, moduleKey, enabled: true },
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

  listRules(tenantId: string, moduleKey?: string) {
    return this.prisma.approvalRule.findMany({
      where: {
        tenantId,
        ...(moduleKey ? { moduleKey } : {}),
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  async createRule(
    tenantId: string,
    data: {
      name: string;
      moduleKey?: string;
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
    const moduleKey = data.moduleKey?.trim() || 'invoices';
    return this.prisma.approvalRule.create({
      data: {
        tenantId,
        moduleKey,
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
      moduleKey?: string;
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
        moduleKey: data.moduleKey?.trim(),
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

    if (decision === 'approved') {
      await this.assertCanApprove(tenantId, task.invoiceId, userId);
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

  /** Force-approve path — still respects SoD own-approve when submittedBy is known. */
  async assertCanApprove(tenantId: string, invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const sod = await this.listEnabledSod(tenantId);
    const blockOwn = sod.some((p) => p.ruleKey === 'cannot_approve_own_invoice');
    const submitterId = invoice.submittedById;

    if (blockOwn && submitterId && submitterId === userId) {
      throw new ForbiddenException(
        'Segregation of duties: you cannot approve an invoice you submitted',
      );
    }

    if (submitterId) {
      const [submitter, approver] = await Promise.all([
        this.prisma.user.findFirst({ where: { id: submitterId, tenantId } }),
        this.prisma.user.findFirst({ where: { id: userId, tenantId } }),
      ]);
      if (submitter && approver) {
        const conflict = sod.find(
          (p) =>
            p.ruleKey === 'role_pair_conflict' &&
            p.submitterRole === submitter.role &&
            p.approverRole === approver.role,
        );
        if (conflict) {
          throw new ForbiddenException(
            `Segregation of duties: ${submitter.role} submissions cannot be approved by ${approver.role}`,
          );
        }
      }
    }
  }

  async listSodPolicies(tenantId: string) {
    await this.ensureDefaultSod(tenantId);
    return this.prisma.sodPolicy.findMany({
      where: { tenantId },
      orderBy: [{ ruleKey: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateSodPolicy(
    tenantId: string,
    id: string,
    data: { enabled?: boolean },
  ) {
    const existing = await this.prisma.sodPolicy.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('SoD policy not found');
    return this.prisma.sodPolicy.update({
      where: { id },
      data: { enabled: data.enabled },
    });
  }

  async createRolePairSod(
    tenantId: string,
    data: {
      submitterRole: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';
      approverRole: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';
      enabled?: boolean;
    },
  ) {
    if (data.submitterRole === data.approverRole) {
      throw new BadRequestException('Submitter and approver roles must differ');
    }
    const existing = await this.prisma.sodPolicy.findFirst({
      where: {
        tenantId,
        ruleKey: 'role_pair_conflict',
        submitterRole: data.submitterRole,
        approverRole: data.approverRole,
      },
    });
    if (existing) {
      return this.prisma.sodPolicy.update({
        where: { id: existing.id },
        data: { enabled: data.enabled ?? true },
      });
    }
    return this.prisma.sodPolicy.create({
      data: {
        tenantId,
        ruleKey: 'role_pair_conflict',
        submitterRole: data.submitterRole,
        approverRole: data.approverRole,
        enabled: data.enabled ?? true,
      },
    });
  }

  async deleteSodPolicy(tenantId: string, id: string) {
    const existing = await this.prisma.sodPolicy.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('SoD policy not found');
    if (existing.ruleKey === 'cannot_approve_own_invoice') {
      throw new BadRequestException(
        'Disable cannot_approve_own_invoice instead of deleting it',
      );
    }
    await this.prisma.sodPolicy.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureDefaultSod(tenantId: string) {
    const own = await this.prisma.sodPolicy.findFirst({
      where: { tenantId, ruleKey: 'cannot_approve_own_invoice' },
    });
    if (!own) {
      await this.prisma.sodPolicy.create({
        data: {
          tenantId,
          ruleKey: 'cannot_approve_own_invoice',
          enabled: true,
        },
      });
    }
  }

  private async listEnabledSod(tenantId: string) {
    await this.ensureDefaultSod(tenantId);
    return this.prisma.sodPolicy.findMany({
      where: { tenantId, enabled: true },
    });
  }

  private applySodAssigneeFilter<
    T extends { id: string; role: string },
  >(
    users: T[],
    submitterId: string,
    submitterRole: string | null,
    sod: {
      ruleKey: string;
      submitterRole: string | null;
      approverRole: string | null;
    }[],
  ): T[] {
    const blockOwn = sod.some((p) => p.ruleKey === 'cannot_approve_own_invoice');
    const pairs = sod.filter((p) => p.ruleKey === 'role_pair_conflict');
    return users.filter((user) => {
      if (blockOwn && user.id === submitterId) return false;
      if (submitterRole) {
        for (const pair of pairs) {
          if (
            pair.submitterRole === submitterRole &&
            pair.approverRole === user.role
          ) {
            return false;
          }
        }
      }
      return true;
    });
  }

  private async finalizeApprove(
    tenantId: string,
    invoiceId: string,
    actorId?: string,
    extras?: { submittedById?: string },
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
        ...(extras?.submittedById
          ? { submittedById: extras.submittedById }
          : {}),
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
