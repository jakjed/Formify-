import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { InvoiceValidationService } from '../../invoice-rules/application/invoice-validation.service';
import { UsageService } from '../../usage/application/usage.service';
import { WorkflowService } from '../../workflow/application/workflow.service';

export type InvoiceListQuery = {
  status?: InvoiceStatus | InvoiceStatus[];
  q?: string;
  exceptionCode?: string;
  hasOpenExceptions?: boolean;
  sort?: 'created_desc' | 'created_asc' | 'total_desc' | 'total_asc' | 'age_desc';
  limit?: number;
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly workflow: WorkflowService,
    private readonly validation: InvoiceValidationService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string, query: InvoiceListQuery = {}) {
    const statuses = normalizeStatuses(query.status);
    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(statuses.length === 1
        ? { status: statuses[0] }
        : statuses.length > 1
          ? { status: { in: statuses } }
          : {}),
      ...(query.hasOpenExceptions
        ? { exceptions: { some: { resolved: false } } }
        : {}),
      ...(query.exceptionCode
        ? {
            exceptions: {
              some: { resolved: false, code: query.exceptionCode },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                vendorNameRaw: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                fileAsset: {
                  originalName: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const orderBy = sortToOrderBy(query.sort ?? 'created_desc');
    const take = Math.min(Math.max(query.limit ?? 100, 1), 500);

    return this.prisma.invoice.findMany({
      where,
      orderBy,
      take,
      include: {
        fileAsset: true,
        exceptions: { where: { resolved: false } },
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  async exportCsv(tenantId: string, query: InvoiceListQuery = {}) {
    const rows = await this.list(tenantId, { ...query, limit: query.limit ?? 500 });
    const header = [
      'id',
      'status',
      'invoiceNumber',
      'vendorName',
      'currency',
      'subtotalMinor',
      'taxMinor',
      'totalMinor',
      'invoiceDate',
      'dueDate',
      'exceptionCodes',
      'createdAt',
    ];
    const lines = rows.map((row) =>
      [
        row.id,
        row.status,
        row.invoiceNumber ?? '',
        row.vendorNameRaw ?? '',
        row.currency,
        row.subtotalMinor ?? '',
        row.taxMinor ?? '',
        row.totalMinor ?? '',
        row.invoiceDate?.toISOString().slice(0, 10) ?? '',
        row.dueDate?.toISOString().slice(0, 10) ?? '',
        row.exceptions.map((e) => e.code).join('|'),
        row.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(','),
    );
    return `${header.join(',')}\n${lines.join('\n')}\n`;
  }

  async listExceptionQueue(tenantId: string, exceptionCode?: string) {
    const exceptions = await this.prisma.invoiceException.findMany({
      where: {
        resolved: false,
        ...(exceptionCode ? { code: exceptionCode } : {}),
        invoice: { tenantId },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        invoice: {
          select: {
            id: true,
            status: true,
            invoiceNumber: true,
            vendorNameRaw: true,
            currency: true,
            totalMinor: true,
            createdAt: true,
          },
        },
      },
      take: 200,
    });

    const now = Date.now();
    const items = exceptions.map((row) => {
      const ageHours =
        Math.round(
          ((now - row.createdAt.getTime()) / (1000 * 60 * 60)) * 10,
        ) / 10;
      return {
        id: row.id,
        code: row.code,
        message: row.message,
        createdAt: row.createdAt.toISOString(),
        ageHours,
        invoice: {
          id: row.invoice.id,
          status: row.invoice.status,
          invoiceNumber: row.invoice.invoiceNumber,
          vendorNameRaw: row.invoice.vendorNameRaw,
          currency: row.invoice.currency,
          totalMinor: row.invoice.totalMinor,
          createdAt: row.invoice.createdAt.toISOString(),
        },
      };
    });

    const byCode = new Map<string, number>();
    for (const item of items) {
      byCode.set(item.code, (byCode.get(item.code) ?? 0) + 1);
    }

    return {
      total: items.length,
      byCode: [...byCode.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      items,
    };
  }

  async getOpsDashboard(tenantId: string) {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    const [statusGroups, openExceptions, exportBacklog, usage] =
      await Promise.all([
        this.prisma.invoice.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.invoiceException.findMany({
          where: { resolved: false, invoice: { tenantId } },
          select: { createdAt: true, code: true },
        }),
        this.prisma.invoice.count({
          where: { tenantId, status: 'approved' },
        }),
        this.usage.getUsageSummary(tenantId),
      ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusGroups) {
      byStatus[row.status] = row._count._all;
    }

    const aging = { under24h: 0, d1to3: 0, over3d: 0 };
    const exceptionByCode = new Map<string, number>();
    for (const ex of openExceptions) {
      const age = now - ex.createdAt.getTime();
      if (age < dayMs) aging.under24h += 1;
      else if (age < dayMs * 3) aging.d1to3 += 1;
      else aging.over3d += 1;
      exceptionByCode.set(ex.code, (exceptionByCode.get(ex.code) ?? 0) + 1);
    }

    const needsReview = byStatus.needs_review ?? 0;
    const inApproval = byStatus.in_approval ?? 0;
    const exceptionStatus = byStatus.exception ?? 0;
    const totalOpen =
      needsReview + inApproval + exceptionStatus + (byStatus.extracting ?? 0);

    return {
      byStatus,
      openWork: {
        needsReview,
        inApproval,
        exception: exceptionStatus,
        totalOpen,
      },
      exceptions: {
        openCount: openExceptions.length,
        aging,
        byCode: [...exceptionByCode.entries()]
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count),
      },
      exportBacklog,
      usage: {
        approvedInvoicesMtd: usage.approvedInvoicesMtd,
        approvedInvoices: usage.approvedInvoices,
        ocrPagesThisMonth: usage.ocrPagesThisMonth,
        yearMonth: usage.yearMonth,
        planName: usage.planName,
        softWarned: usage.softWarned,
        hardBlocked: usage.hardBlocked,
      },
    };
  }

  async get(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
        purchaseOrder: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            totalMinor: true,
            vendorId: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      vendorId?: string | null;
      vendorNameRaw?: string | null;
      invoiceNumber?: string | null;
      invoiceDate?: string | null;
      dueDate?: string | null;
      currency?: string;
      subtotalMinor?: number | null;
      taxMinor?: number | null;
      totalMinor?: number | null;
      notes?: string | null;
      purchaseOrderId?: string | null;
      actorUserId?: string;
    },
  ) {
    await this.get(tenantId, id);
    if (data.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: data.purchaseOrderId, tenantId },
        select: { id: true },
      });
      if (!po) throw new BadRequestException('Purchase order not found');
    }
    await this.prisma.invoice.update({
      where: { id },
      data: {
        vendorId: data.vendorId,
        vendorNameRaw: data.vendorNameRaw,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate
          ? new Date(data.invoiceDate)
          : data.invoiceDate === null
            ? null
            : undefined,
        dueDate: data.dueDate
          ? new Date(data.dueDate)
          : data.dueDate === null
            ? null
            : undefined,
        currency: data.currency,
        subtotalMinor: data.subtotalMinor,
        taxMinor: data.taxMinor,
        totalMinor: data.totalMinor,
        notes: data.notes,
        purchaseOrderId: data.purchaseOrderId,
      },
    });
    await this.validation.syncExceptions(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: data.actorUserId,
      action: 'invoice.updated',
      entityType: 'Invoice',
      entityId: id,
    });
    return this.get(tenantId, id);
  }

  async listComments(tenantId: string, invoiceId: string) {
    await this.get(tenantId, invoiceId);
    const rows = await this.prisma.invoiceComment.findMany({
      where: { tenantId, invoiceId },
      orderBy: { createdAt: 'asc' },
    });
    const authors = await this.loadAuthorMap(
      tenantId,
      rows.map((r) => r.authorId),
    );
    return rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      authorName: authors.get(row.authorId) ?? 'Unknown',
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async addComment(
    tenantId: string,
    invoiceId: string,
    authorId: string,
    body: string,
  ) {
    await this.get(tenantId, invoiceId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment body is required');
    }
    const comment = await this.prisma.invoiceComment.create({
      data: {
        tenantId,
        invoiceId,
        authorId,
        body: trimmed,
      },
    });
    await this.audit.record({
      tenantId,
      actorId: authorId,
      action: 'invoice.comment_added',
      entityType: 'Invoice',
      entityId: invoiceId,
      meta: { commentId: comment.id },
    });
    const authors = await this.loadAuthorMap(tenantId, [authorId]);
    return {
      id: comment.id,
      authorId: comment.authorId,
      authorName: authors.get(authorId) ?? 'Unknown',
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async getActivity(tenantId: string, invoiceId: string) {
    await this.get(tenantId, invoiceId);
    const [auditRows, comments] = await Promise.all([
      this.audit.listForEntity(tenantId, 'Invoice', invoiceId, 50),
      this.prisma.invoiceComment.findMany({
        where: { tenantId, invoiceId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const authors = await this.loadAuthorMap(
      tenantId,
      [
        ...auditRows.map((r) => r.actorId).filter(Boolean),
        ...comments.map((c) => c.authorId),
      ] as string[],
    );

    const auditItems = auditRows
      .filter((row) => row.action !== 'invoice.comment_added')
      .map((row) => ({
      id: row.id,
      kind: 'audit' as const,
      at: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorName: row.actorId ? authors.get(row.actorId) ?? null : null,
      action: row.action,
      meta: row.meta,
    }));

    const commentItems = comments.map((row) => ({
      id: row.id,
      kind: 'comment' as const,
      at: row.createdAt.toISOString(),
      actorId: row.authorId,
      actorName: authors.get(row.authorId) ?? null,
      body: row.body,
    }));

    return [...auditItems, ...commentItems].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }

  private async loadAuthorMap(tenantId: string, userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((u) => [u.id, u.displayName]));
  }

  async validate(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const result = await this.validation.syncExceptions(tenantId, id);
    const invoice = await this.get(tenantId, id);
    return { ...result, invoice };
  }

  async resolveExceptions(
    tenantId: string,
    id: string,
    actorUserId?: string,
  ) {
    await this.get(tenantId, id);
    await this.prisma.invoiceException.updateMany({
      where: { invoiceId: id, resolved: false },
      data: { resolved: true },
    });
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });
    if (invoice?.status === 'exception') {
      await this.prisma.invoice.update({
        where: { id },
        data: { status: 'needs_review' },
      });
    }
    await this.audit.record({
      tenantId,
      actorId: actorUserId,
      action: 'invoice.exceptions_resolved',
      entityType: 'Invoice',
      entityId: id,
    });
    return this.get(tenantId, id);
  }

  async submit(tenantId: string, id: string, actorUserId: string) {
    const gate = await this.validation.assertReadyForApproval(tenantId, id);
    if (gate.blocking) {
      throw new BadRequestException(
        `Cannot submit: ${gate.summary}. Fix exceptions and save again.`,
      );
    }
    return this.workflow.submitInvoice(tenantId, id, actorUserId);
  }

  async approve(tenantId: string, id: string) {
    const invoice = await this.get(tenantId, id);
    if (['void', 'exported'].includes(invoice.status)) {
      throw new BadRequestException(
        `Cannot approve invoice in status ${invoice.status}`,
      );
    }

    const gate = await this.validation.assertReadyForApproval(tenantId, id);
    if (gate.blocking) {
      throw new BadRequestException(
        `Cannot approve: ${gate.summary}. Fix exceptions and save again.`,
      );
    }

    const usage = await this.usage.getUsageSummary(tenantId);
    if (usage.hardBlocked) {
      throw new BadRequestException(
        `Approved invoice hard limit reached (${usage.approvedHardLimit} MTD)`,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
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

    await this.usage.recordInvoiceApproved(tenantId, id);
    return updated;
  }

  async void(tenantId: string, id: string, actorUserId?: string) {
    await this.get(tenantId, id);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'void' },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    await this.audit.record({
      tenantId,
      actorId: actorUserId,
      action: 'invoice.voided',
      entityType: 'Invoice',
      entityId: id,
    });
    return updated;
  }
}

function normalizeStatuses(
  status?: InvoiceStatus | InvoiceStatus[],
): InvoiceStatus[] {
  if (!status) return [];
  return Array.isArray(status) ? status : [status];
}

function sortToOrderBy(
  sort: NonNullable<InvoiceListQuery['sort']>,
): Prisma.InvoiceOrderByWithRelationInput {
  switch (sort) {
    case 'created_asc':
      return { createdAt: 'asc' };
    case 'total_desc':
      return { totalMinor: 'desc' };
    case 'total_asc':
      return { totalMinor: 'asc' };
    case 'age_desc':
      return { createdAt: 'asc' };
    case 'created_desc':
    default:
      return { createdAt: 'desc' };
  }
}

function csvEscape(value: string | number): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
