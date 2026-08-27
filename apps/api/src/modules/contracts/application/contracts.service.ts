import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import {
  CONTRACT_APPROVAL_CHAIN,
  CONTRACT_DOC_CATEGORIES,
  emptySignature,
  type RedFlag,
  type SignatureEnvelope,
} from './procure-constants';

const contractInclude = {
  vendor: { select: { id: true, code: true, name: true } },
  entity: { select: { id: true, code: true, name: true } },
  documents: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ContractInclude;

type ContractFieldInput = {
  number?: string;
  title?: string;
  vendorId?: string | null;
  entityId?: string | null;
  currency?: string;
  valueMinor?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  agreementType?: string | null;
  purpose?: string | null;
  serviceDescription?: string | null;
  costCenter?: string | null;
  termType?: string | null;
  noticePeriod?: string | null;
  clmTool?: string | null;
  ownerName?: string | null;
  contractDate?: string | null;
  approvalStage?: number;
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(
    tenantId: string,
    opts?: { status?: ContractStatus; q?: string },
  ) {
    const q = opts?.q?.trim();
    return this.prisma.contract.findMany({
      where: {
        tenantId,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { title: { contains: q, mode: 'insensitive' } },
                { vendor: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
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
      agreementType?: string;
      purpose?: string;
      serviceDescription?: string;
      costCenter?: string;
      termType?: string;
      noticePeriod?: string;
      clmTool?: string;
      ownerName?: string;
      contractDate?: string;
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
          agreementType: input.agreementType,
          purpose: input.purpose,
          serviceDescription: input.serviceDescription,
          costCenter: input.costCenter,
          termType: input.termType,
          noticePeriod: input.noticePeriod,
          clmTool: input.clmTool,
          ownerName: input.ownerName,
          contractDate: input.contractDate
            ? new Date(input.contractDate)
            : null,
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
    data: ContractFieldInput,
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
      data: this.mapOptionalFields(data),
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
      in_approval: ['pending_signature', 'active', 'draft', 'cancelled'],
      pending_signature: ['active', 'cancelled'],
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

  async sendForApproval(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'draft') {
      throw new BadRequestException(
        'Only draft contracts can be sent for approval',
      );
    }
    await this.prisma.contract.update({
      where: { id },
      data: { status: 'in_approval', approvalStage: 1 },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.send_for_approval',
      entityType: 'Contract',
      entityId: id,
      meta: { approvalStage: 1 },
    });
    return this.get(tenantId, id);
  }

  async advanceApproval(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'in_approval') {
      throw new BadRequestException(
        'Only contracts in approval can be advanced',
      );
    }
    const nextStage = existing.approvalStage + 1;
    if (nextStage > CONTRACT_APPROVAL_CHAIN.length) {
      const signature = emptySignature(
        existing.ownerName ?? '',
        existing.vendor?.name ?? '',
      );
      await this.prisma.contract.update({
        where: { id },
        data: {
          status: 'pending_signature',
          approvalStage: CONTRACT_APPROVAL_CHAIN.length,
          signatureJson: signature as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'contract.advance_approval',
        entityType: 'Contract',
        entityId: id,
        meta: { to: 'pending_signature' },
      });
    } else {
      await this.prisma.contract.update({
        where: { id },
        data: { approvalStage: nextStage },
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'contract.advance_approval',
        entityType: 'Contract',
        entityId: id,
        meta: {
          approvalStage: nextStage,
          stageName: CONTRACT_APPROVAL_CHAIN[nextStage - 1],
        },
      });
    }
    return this.get(tenantId, id);
  }

  async sendForSignature(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'pending_signature') {
      throw new BadRequestException(
        'Only contracts pending signature can be sent for signature',
      );
    }
    let signature = this.readSignature(existing.signatureJson);
    if (!signature) {
      signature = emptySignature(
        existing.ownerName ?? '',
        existing.vendor?.name ?? '',
      );
    }
    const envelopeId = `DS-${Date.now().toString(36).toUpperCase()}`;
    signature = {
      ...signature,
      status: 'Sent',
      envelopeId,
      sentAt: new Date().toISOString(),
      signers: signature.signers.map((s) =>
        s.status === 'Waiting' ? { ...s, status: 'Sent' as const } : s,
      ),
    };
    await this.prisma.contract.update({
      where: { id },
      data: {
        signatureJson: signature as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.send_for_signature',
      entityType: 'Contract',
      entityId: id,
      meta: { envelopeId },
    });
    return this.get(tenantId, id);
  }

  async checkSignatureStatus(tenantId: string, id: string, actorId: string) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'pending_signature') {
      throw new BadRequestException(
        'Signature status can only be checked for contracts pending signature',
      );
    }
    const signature = this.readSignature(existing.signatureJson);
    if (!signature) {
      throw new BadRequestException('Signature envelope not initialized');
    }
    const idx = signature.signers.findIndex((s) => s.status !== 'Signed');
    if (idx === -1) {
      return this.get(tenantId, id);
    }
    const current = signature.signers[idx]!;
    const signed = {
      ...current,
      status: 'Signed' as const,
      signedAt: new Date().toISOString(),
    };
    const next = signature.signers.map((s, i) => (i === idx ? signed : s));
    const updated: SignatureEnvelope = { ...signature, signers: next };
    await this.prisma.contract.update({
      where: { id },
      data: {
        signatureJson: updated as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.check_signature',
      entityType: 'Contract',
      entityId: id,
      meta: { signer: signed.name, role: signed.role },
    });
    return this.get(tenantId, id);
  }

  async completeSignature(
    tenantId: string,
    id: string,
    actorId: string,
    opts?: { fileName?: string },
  ) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'pending_signature') {
      throw new BadRequestException(
        'Only contracts pending signature can be completed',
      );
    }
    const signature = this.readSignature(existing.signatureJson);
    if (!signature) {
      throw new BadRequestException('Signature envelope not initialized');
    }
    if (!signature.signers.every((s) => s.status === 'Signed')) {
      throw new BadRequestException('Not all signers have signed yet');
    }
    const completed: SignatureEnvelope = {
      ...signature,
      status: 'Completed',
    };
    const fileName =
      opts?.fileName?.trim() ||
      `Executed-${existing.number}.pdf`;

    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: {
          status: 'active',
          signatureJson: completed as unknown as Prisma.InputJsonValue,
          startDate: existing.startDate ?? new Date(),
        },
      });
      await tx.contractDocument.create({
        data: {
          tenantId,
          contractId: id,
          category: 'executed',
          fileName,
        },
      });
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.complete_signature',
      entityType: 'Contract',
      entityId: id,
      meta: { fileName },
    });
    return this.get(tenantId, id);
  }

  async addDocument(
    tenantId: string,
    contractId: string,
    actorId: string,
    input: { category: string; fileName: string },
  ) {
    await this.get(tenantId, contractId);
    const category = input.category.trim();
    if (
      !(CONTRACT_DOC_CATEGORIES as readonly string[]).includes(category)
    ) {
      throw new BadRequestException(
        `Invalid document category. Allowed: ${CONTRACT_DOC_CATEGORIES.join(', ')}`,
      );
    }
    const fileName = input.fileName.trim();
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }
    const doc = await this.prisma.contractDocument.create({
      data: {
        tenantId,
        contractId,
        category,
        fileName,
      },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.document_added',
      entityType: 'Contract',
      entityId: contractId,
      meta: { documentId: doc.id, category, fileName },
    });
    return this.get(tenantId, contractId);
  }

  async removeDocument(
    tenantId: string,
    contractId: string,
    docId: string,
    actorId: string,
  ) {
    await this.get(tenantId, contractId);
    const doc = await this.prisma.contractDocument.findFirst({
      where: { id: docId, tenantId, contractId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.contractDocument.delete({ where: { id: docId } });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.document_removed',
      entityType: 'Contract',
      entityId: contractId,
      meta: { documentId: docId, fileName: doc.fileName },
    });
    return this.get(tenantId, contractId);
  }

  async aiSummarize(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    const vendor = row.vendor?.name ?? 'the counterparty';
    const value =
      row.valueMinor != null
        ? `${(row.valueMinor / 100).toFixed(2)} ${row.currency}`
        : 'an unspecified value';
    const summary = [
      `Multi-function AI summary for ${row.number} (${row.title}).`,
      `Agreement type: ${row.agreementType ?? 'not specified'}; counterparty: ${vendor}.`,
      `Commercial value: ${value}. Purpose: ${row.purpose ?? 'not captured'}.`,
      `Services: ${row.serviceDescription ?? 'not captured'}.`,
      `Term: ${row.termType ?? 'standard'} with notice period ${row.noticePeriod ?? 'n/a'}.`,
      `Risk posture: ${(row.redFlagsJson as RedFlag[] | null)?.length ?? 0} red flag(s) on file.`,
      `Recommended next step: complete remaining approvals and route for e-signature.`,
    ].join(' ');
    return { summary, contractId: id };
  }

  async scanRedFlags(tenantId: string, id: string, actorId: string) {
    await this.get(tenantId, id);
    const flags: RedFlag[] = [
      {
        severity: 'High',
        text: 'Unlimited liability carve-outs may expose the buyer beyond insurance limits.',
      },
      {
        severity: 'Medium',
        text: 'Auto-renewal clause lacks a clear opt-out window before the renewal date.',
      },
      {
        severity: 'Low',
        text: 'Notice period is shorter than internal procurement policy for this spend tier.',
      },
    ];
    await this.prisma.contract.update({
      where: { id },
      data: { redFlagsJson: flags as unknown as Prisma.InputJsonValue },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'contract.scan_red_flags',
      entityType: 'Contract',
      entityId: id,
      meta: { count: flags.length },
    });
    return { redFlags: flags, contract: await this.get(tenantId, id) };
  }

  async aiIntake(
    tenantId: string,
    actorId: string,
    input: { vendorId?: string; fileName?: string; title?: string },
  ) {
    await this.assertVendor(tenantId, input.vendorId);
    const stamp = Date.now().toString(36).toUpperCase();
    const number = `AI-${stamp}`;
    const title =
      input.title?.trim() ||
      `AI intake ${input.fileName?.trim() || 'document'}`;
    const redFlags: RedFlag[] = [
      {
        severity: 'Medium',
        text: 'Extracted payment terms differ from standard Net-30 policy.',
      },
      {
        severity: 'Low',
        text: 'Governing law clause could not be confidently extracted from the upload.',
      },
    ];

    try {
      const row = await this.prisma.contract.create({
        data: {
          tenantId,
          number,
          title,
          vendorId: input.vendorId,
          status: 'draft',
          aiExtracted: true,
          agreementType: 'Vendor Agreement',
          purpose:
            'Stub AI intake: commercial relationship covering recurring vendor services.',
          serviceDescription:
            'Stub AI intake: professional / SaaS services as described in the uploaded agreement.',
          redFlagsJson: redFlags as unknown as Prisma.InputJsonValue,
          notes: input.fileName
            ? `Source file: ${input.fileName.trim()}`
            : undefined,
        },
        include: contractInclude,
      });

      if (input.fileName?.trim()) {
        await this.prisma.contractDocument.create({
          data: {
            tenantId,
            contractId: row.id,
            category: 'draft',
            fileName: input.fileName.trim(),
          },
        });
      }

      await this.audit.record({
        tenantId,
        actorId,
        action: 'contract.ai_intake',
        entityType: 'Contract',
        entityId: row.id,
        meta: { number: row.number, fileName: input.fileName ?? null },
      });
      return this.get(tenantId, row.id);
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

  private mapOptionalFields(
    data: ContractFieldInput,
  ): Prisma.ContractUncheckedUpdateInput {
    return {
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
      agreementType: data.agreementType,
      purpose: data.purpose,
      serviceDescription: data.serviceDescription,
      costCenter: data.costCenter,
      termType: data.termType,
      noticePeriod: data.noticePeriod,
      clmTool: data.clmTool,
      ownerName: data.ownerName,
      contractDate:
        data.contractDate === undefined
          ? undefined
          : data.contractDate
            ? new Date(data.contractDate)
            : null,
      approvalStage: data.approvalStage,
    };
  }

  private readSignature(raw: unknown): SignatureEnvelope | null {
    if (!raw || typeof raw !== 'object') return null;
    return raw as SignatureEnvelope;
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
