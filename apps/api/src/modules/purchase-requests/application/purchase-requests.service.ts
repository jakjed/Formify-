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
  sourceContract: {
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      valueMinor: true,
      currency: true,
      vendorId: true,
    },
  },
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

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    input: {
      title?: string;
      notes?: string;
      department?: string;
      category?: string;
      vendorId?: string | null;
      entityId?: string | null;
      totalMinor?: number;
      lines?: {
        lineNo?: number;
        description?: string;
        quantity?: number;
        unitPriceMinor?: number;
        amountMinor?: number;
      }[];
    },
  ) {
    const existing = await this.get(tenantId, id);
    if (existing.status !== 'draft' && existing.status !== 'in_approval') {
      throw new BadRequestException(
        `Cannot update PR in status ${existing.status}`,
      );
    }
    if (input.vendorId) {
      await this.assertVendor(tenantId, input.vendorId);
    }
    if (input.entityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: input.entityId, tenantId },
        select: { id: true },
      });
      if (!entity) throw new BadRequestException('Entity not found');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (input.lines?.length) {
        for (const line of input.lines) {
          const lineNo = line.lineNo;
          if (lineNo == null) continue;
          const match = existing.lines.find((l) => l.lineNo === lineNo);
          if (!match) {
            throw new BadRequestException(`Unknown lineNo ${lineNo}`);
          }
          await tx.purchaseRequestLine.update({
            where: { id: match.id },
            data: {
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
              amountMinor: line.amountMinor,
            },
          });
        }
      } else if (
        input.totalMinor !== undefined &&
        existing.lines.length === 1
      ) {
        const onlyLine = existing.lines[0]!;
        await tx.purchaseRequestLine.update({
          where: { id: onlyLine.id },
          data: { amountMinor: input.totalMinor },
        });
      }

      return tx.purchaseRequest.update({
        where: { id },
        data: {
          title: input.title?.trim(),
          notes: input.notes,
          department: input.department,
          category: input.category,
          ...(input.vendorId !== undefined
            ? { vendorId: input.vendorId }
            : {}),
          ...(input.entityId !== undefined
            ? { entityId: input.entityId }
            : {}),
          ...(input.totalMinor !== undefined
            ? { totalMinor: input.totalMinor }
            : {}),
        },
        include: prInclude,
      });
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'pr.updated',
      entityType: 'PurchaseRequest',
      entityId: id,
    });
    return row;
  }

  async create(
    tenantId: string,
    actorId: string,
    input: {
      number: string;
      title: string;
      entityId?: string;
      vendorId?: string;
      sourceContractId?: string;
      department?: string;
      category?: string;
      approvalStage?: number;
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
    if (input.vendorId) {
      await this.assertVendor(tenantId, input.vendorId);
    }
    if (input.sourceContractId) {
      await this.assertContract(tenantId, input.sourceContractId);
    }
    try {
      const row = await this.prisma.purchaseRequest.create({
        data: {
          tenantId,
          number: input.number.trim(),
          title: input.title.trim(),
          entityId: input.entityId,
          vendorId: input.vendorId,
          sourceContractId: input.sourceContractId,
          department: input.department,
          category: input.category,
          approvalStage: input.approvalStage ?? 0,
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

  /**
   * Active contracts that do not yet have a PR linked via sourceContractId.
   */
  async listProposals(tenantId: string) {
    const linked = await this.prisma.purchaseRequest.findMany({
      where: { tenantId, sourceContractId: { not: null } },
      select: { sourceContractId: true },
    });
    const usedIds = linked
      .map((r) => r.sourceContractId)
      .filter((id): id is string => Boolean(id));

    return this.prisma.contract.findMany({
      where: {
        tenantId,
        status: 'active',
        ...(usedIds.length ? { id: { notIn: usedIds } } : {}),
      },
      include: {
        vendor: { select: { id: true, code: true, name: true } },
        entity: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createFromProposal(
    tenantId: string,
    actorId: string,
    input: {
      contractId: string;
      department?: string;
      category?: string;
      totalMinor?: number;
      entityId?: string;
    },
  ) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: input.contractId, tenantId },
      include: { vendor: { select: { id: true, name: true } } },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'active') {
      throw new BadRequestException(
        'Only active contracts can be accepted as proposals',
      );
    }

    const existing = await this.prisma.purchaseRequest.findFirst({
      where: { tenantId, sourceContractId: contract.id },
      select: { id: true, number: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Contract already has purchase request ${existing.number}`,
      );
    }

    if (input.entityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: input.entityId, tenantId },
        select: { id: true },
      });
      if (!entity) throw new BadRequestException('Entity not found');
    }

    const number = `PR-${contract.number}`.slice(0, 64);
    try {
      const row = await this.prisma.purchaseRequest.create({
        data: {
          tenantId,
          number,
          title: contract.title,
          status: 'in_approval',
          approvalStage: 1,
          requesterId: actorId,
          vendorId: contract.vendorId,
          sourceContractId: contract.id,
          entityId: input.entityId ?? contract.entityId,
          department: input.department,
          category: input.category,
          currency: contract.currency,
          totalMinor: input.totalMinor ?? contract.valueMinor,
          notes: `Created from contract proposal ${contract.number}`,
        },
        include: prInclude,
      });
      await this.audit.record({
        tenantId,
        actorId,
        action: 'pr.created_from_proposal',
        entityType: 'PurchaseRequest',
        entityId: row.id,
        meta: { number: row.number, contractId: contract.id },
      });
      return row;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `PR number "${number}" already exists — rename the contract number or create manually`,
        );
      }
      throw err;
    }
  }

  private async assertVendor(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId },
      select: { id: true },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');
  }

  private async assertContract(tenantId: string, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });
    if (!contract) throw new BadRequestException('Contract not found');
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
            vendorId: input.vendorId ?? pr.vendorId ?? undefined,
            contractId: input.contractId ?? pr.sourceContractId ?? undefined,
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
