import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    tenantId: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  }) {
    return this.prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  list(tenantId: string, limit = 100) {
    return this.prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
