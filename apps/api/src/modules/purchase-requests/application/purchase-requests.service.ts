import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';

@Injectable()
export class PurchaseRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.purchaseRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
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
        include: { lines: { orderBy: { lineNo: 'asc' } } },
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
    const allowed: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
      draft: ['in_approval', 'cancelled'],
      in_approval: ['approved', 'draft', 'cancelled'],
      approved: ['converted', 'cancelled'],
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
      include: { lines: { orderBy: { lineNo: 'asc' } } },
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
}
