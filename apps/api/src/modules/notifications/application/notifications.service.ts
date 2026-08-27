import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    href?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
      },
    });
  }

  async notifyMany(
    items: {
      tenantId: string;
      userId: string;
      type: string;
      title: string;
      body?: string;
      href?: string;
    }[],
  ) {
    if (items.length === 0) return { count: 0 };
    await this.prisma.notification.createMany({ data: items });
    return { count: items.length };
  }

  async notifyRoles(
    tenantId: string,
    roles: Array<'admin' | 'ap_manager' | 'ap_clerk' | 'approver'>,
    payload: {
      type: string;
      title: string;
      body?: string;
      href?: string;
      excludeUserId?: string;
    },
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: roles },
        ...(payload.excludeUserId
          ? { NOT: { id: payload.excludeUserId } }
          : {}),
      },
      select: { id: true },
    });
    return this.notifyMany(
      users.map((user) => ({
        tenantId,
        userId: user.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        href: payload.href,
      })),
    );
  }

  listForUser(tenantId: string, userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, tenantId, userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async getOutboundEmail(tenantId: string) {
    const row = await this.prisma.tenantOutboundEmail.findUnique({
      where: { tenantId },
    });
    if (!row) {
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });
      return {
        fromAddress: `notifications@${tenant.slug}.aptora.local`,
        fromName: `${tenant.name} AP`,
        replyTo: null as string | null,
        enabled: false,
        configured: false,
      };
    }
    return {
      fromAddress: row.fromAddress,
      fromName: row.fromName,
      replyTo: row.replyTo,
      enabled: row.enabled,
      configured: true,
    };
  }

  async upsertOutboundEmail(
    tenantId: string,
    input: {
      fromAddress: string;
      fromName?: string;
      replyTo?: string;
      enabled?: boolean;
    },
  ) {
    const row = await this.prisma.tenantOutboundEmail.upsert({
      where: { tenantId },
      create: {
        tenantId,
        fromAddress: input.fromAddress.trim(),
        fromName: input.fromName?.trim() || null,
        replyTo: input.replyTo?.trim() || null,
        enabled: input.enabled ?? true,
      },
      update: {
        fromAddress: input.fromAddress.trim(),
        fromName: input.fromName?.trim() || null,
        replyTo: input.replyTo?.trim() || null,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
    return {
      fromAddress: row.fromAddress,
      fromName: row.fromName,
      replyTo: row.replyTo,
      enabled: row.enabled,
      configured: true,
    };
  }
}
