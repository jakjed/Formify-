import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.contract.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.contract.findFirst({
      where: { id, tenantId },
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
    const row = await this.prisma.contract.update({
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
    return row;
  }
}
