import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';

const contractInclude = {
  vendor: { select: { id: true, code: true, name: true } },
  entity: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ContractInclude;

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.contract.findMany({
      where: { tenantId },
      include: contractInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.contract.findFirst({
      where: { id, tenantId },
      include: contractInclude,
    });
    if (!row) throw new NotFoundException('Contract not found');
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
      currency?: string;
      valueMinor?: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
    },
  ) {
    await this.assertVendor(tenantId, input.vendorId);
    await this.assertEntity(tenantId, input.entityId);
    try {
      const row = await this.prisma.contract.create({
        data: {
          tenantId,
          number: input.number.trim(),
          title: input.title.trim(),
          vendorId: input.vendorId,
          entityId: input.entityId,
          currency: input.currency ?? 'EUR',
          valueMinor: input.valueMinor,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          notes: input.notes,
        },
        include: contractInclude,
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'contract.created',
        entityType: 'Contract',
        entityId: row.id,
        meta: { number: row.number },
      });
      return row;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Contract number already exists');
      }
      throw err;
    }
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    data: {
      title?: string;
      vendorId?: string | null;
      entityId?: string | null;
      currency?: string;
      valueMinor?: number | null;
      startDate?: string | null;
      endDate?: string | null;
      notes?: string | null;
    },
  ) {
    const existing = await this.get(tenantId, id);
    if (existing.status === 'expired' || existing.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot update contract in status ${existing.status}`,
      );
    }
    if (existing.status === 'active') {
      throw new BadRequestException(
        'Use amend to change an active contract',
      );
    }
    if (data.vendorId !== undefined) {
      await this.assertVendor(tenantId, data.vendorId ?? undefined);
    }
    if (data.entityId !== undefined) {
      await this.assertEntity(tenantId, data.entityId ?? undefined);
    }

    await this.prisma.contract.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        vendorId: data.vendorId,
        entityId: data.entityId,
        currency: data.currency,
        valueMinor: data.valueMinor,
        startDate:
          data.startDate === undefined
            ? undefined
            : data.startDate
              ? new Date(data.startDate)
              : null,
        endDate:
          data.endDate === undefined
            ? undefined
            : data.endDate
              ? new Date(data.endDate)
              : null,
        notes: data.notes,
      },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.updated',
      entityType: 'Contract',
      entityId: id,
    });
    return this.get(tenantId, id);
  }

  async amend(
    tenantId: string,
    id: string,
    actorId: string,
    data: {
      title?: string;
      valueMinor?: number | null;
      startDate?: string | null;
      endDate?: string | null;
      notes?: string | null;
    },
  ) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'active') {
      throw new BadRequestException('Only active contracts can be amended');
    }
    const from = {
      title: existing.title,
      valueMinor: existing.valueMinor,
      startDate: existing.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: existing.endDate?.toISOString().slice(0, 10) ?? null,
      notes: existing.notes,
    };
    await this.prisma.contract.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        valueMinor: data.valueMinor,
        startDate:
          data.startDate === undefined
            ? undefined
            : data.startDate
              ? new Date(data.startDate)
              : null,
        endDate:
          data.endDate === undefined
            ? undefined
            : data.endDate
              ? new Date(data.endDate)
              : null,
        notes: data.notes,
      },
    });
    const updated = await this.get(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.amended',
      entityType: 'Contract',
      entityId: id,
      meta: {
        from,
        to: {
          title: updated.title,
          valueMinor: updated.valueMinor,
          startDate: updated.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: updated.endDate?.toISOString().slice(0, 10) ?? null,
          notes: updated.notes,
        },
      },
    });
    return updated;
  }

  async renew(
    tenantId: string,
    id: string,
    actorId: string,
    endDate: string,
  ) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'active') {
      throw new BadRequestException('Only active contracts can be renewed');
    }
    const nextEnd = new Date(endDate);
    if (existing.endDate && nextEnd <= existing.endDate) {
      throw new BadRequestException('Renewal end date must be after current end date');
    }
    await this.prisma.contract.update({
      where: { id },
      data: { endDate: nextEnd },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.renewed',
      entityType: 'Contract',
      entityId: id,
      meta: {
        from: existing.endDate?.toISOString().slice(0, 10) ?? null,
        to: endDate.slice(0, 10),
      },
    });
    return this.get(tenantId, id);
  }

  async transition(
    tenantId: string,
    id: string,
    actorId: string,
    status: ContractStatus,
  ) {
    const existing = await this.get(tenantId, id);
    const allowed: Record<ContractStatus, ContractStatus[]> = {
      draft: ['in_approval', 'cancelled'],
      in_approval: ['active', 'draft', 'cancelled'],
      active: ['expired', 'cancelled'],
      expired: [],
      cancelled: [],
    };
    if (!allowed[existing.status].includes(status)) {
      throw new BadRequestException(
        `Cannot move contract from ${existing.status} to ${status}`,
      );
    }
    await this.prisma.contract.update({
      where: { id },
      data: { status },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.status',
      entityType: 'Contract',
      entityId: id,
      meta: { from: existing.status, to: status },
    });
    return this.get(tenantId, id);
  }

  async listComments(tenantId: string, contractId: string) {
    await this.get(tenantId, contractId);
    const rows = await this.prisma.contractComment.findMany({
      where: { tenantId, contractId },
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
    contractId: string,
    authorId: string,
    body: string,
  ) {
    await this.get(tenantId, contractId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment body is required');
    }
    const comment = await this.prisma.contractComment.create({
      data: {
        tenantId,
        contractId,
        authorId,
        body: trimmed,
      },
    });
    await this.audit.record({
      tenantId,
      actorId: authorId,
      action: 'contract.comment_added',
      entityType: 'Contract',
      entityId: contractId,
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

  async getActivity(tenantId: string, contractId: string) {
    await this.get(tenantId, contractId);
    const [auditRows, comments] = await Promise.all([
      this.audit.listForEntity(tenantId, 'Contract', contractId, 50),
      this.prisma.contractComment.findMany({
        where: { tenantId, contractId },
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
      .filter((row) => row.action !== 'contract.comment_added')
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

  private async assertVendor(tenantId: string, vendorId?: string) {
    if (!vendorId) return;
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId },
      select: { id: true },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');
  }

  private async assertEntity(tenantId: string, entityId?: string) {
    if (!entityId) return;
    const entity = await this.prisma.entity.findFirst({
      where: { id: entityId, tenantId },
      select: { id: true },
    });
    if (!entity) throw new BadRequestException('Entity not found');
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
}
