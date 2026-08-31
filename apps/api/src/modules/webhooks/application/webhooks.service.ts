import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';

export const WEBHOOK_EVENTS = [
  'invoice.approved',
  'invoice.exported',
  'contract.status',
  'pr.converted',
  'po.received',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  listEvents() {
    return [...WEBHOOK_EVENTS];
  }

  listEndpoints(tenantId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        events: true,
        enabled: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        // secret omitted from list
      },
    });
  }

  async createEndpoint(
    tenantId: string,
    input: { url: string; events: string[]; description?: string },
  ) {
    this.assertUrl(input.url);
    const events = this.normalizeEvents(input.events);
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: input.url.trim(),
        secret,
        events,
        description: input.description?.trim() || null,
      },
    });
    return {
      id: row.id,
      url: row.url,
      events: row.events,
      enabled: row.enabled,
      description: row.description,
      createdAt: row.createdAt,
      secret, // shown once
    };
  }

  async updateEndpoint(
    tenantId: string,
    id: string,
    input: {
      url?: string;
      events?: string[];
      enabled?: boolean;
      description?: string | null;
    },
  ) {
    await this.getEndpoint(tenantId, id);
    if (input.url) this.assertUrl(input.url);
    const row = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        url: input.url?.trim(),
        events: input.events ? this.normalizeEvents(input.events) : undefined,
        enabled: input.enabled,
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
      },
      select: {
        id: true,
        url: true,
        events: true,
        enabled: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row;
  }

  async deleteEndpoint(tenantId: string, id: string) {
    await this.getEndpoint(tenantId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    return { ok: true };
  }

  listDeliveries(tenantId: string, endpointId?: string) {
    return this.prisma.webhookDelivery.findMany({
      where: {
        tenantId,
        ...(endpointId ? { endpointId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        endpointId: true,
        event: true,
        status: true,
        httpStatus: true,
        errorMessage: true,
        attemptCount: true,
        createdAt: true,
        finishedAt: true,
      },
    });
  }

  /**
   * Fan-out signed POSTs to matching enabled endpoints.
   * Failures are recorded; callers are not blocked.
   */
  async dispatch(
    tenantId: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
  ) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        enabled: true,
        events: { has: event },
      },
    });
    if (endpoints.length === 0) return { delivered: 0 };

    const body = JSON.stringify({
      id: randomBytes(8).toString('hex'),
      event,
      createdAt: new Date().toISOString(),
      data,
    });

    let delivered = 0;
    for (const endpoint of endpoints) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          tenantId,
          endpointId: endpoint.id,
          event,
          payloadJson: body,
          status: 'pending',
          attemptCount: 1,
        },
      });
      const signature = createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Procure-Ledger-Event': event,
            'X-Procure-Ledger-Signature': `sha256=${signature}`,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        const ok = res.status >= 200 && res.status < 300;
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: ok ? 'succeeded' : 'failed',
            httpStatus: res.status,
            errorMessage: ok ? null : `HTTP ${res.status}`,
            finishedAt: new Date(),
          },
        });
        if (ok) delivered += 1;
      } catch (err) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            errorMessage:
              err instanceof Error ? err.message.slice(0, 500) : 'dispatch failed',
            finishedAt: new Date(),
          },
        });
      }
    }
    return { delivered };
  }

  private async getEndpoint(tenantId: string, id: string) {
    const row = await this.prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Webhook endpoint not found');
    return row;
  }

  private assertUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Webhook URL must be http(s)');
    }
  }

  private normalizeEvents(events: string[]) {
    const unique = [...new Set(events.map((e) => e.trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException('At least one event is required');
    }
    for (const event of unique) {
      if (!WEBHOOK_EVENTS.includes(event as WebhookEvent)) {
        throw new BadRequestException(`Unsupported event: ${event}`);
      }
    }
    return unique;
  }
}
