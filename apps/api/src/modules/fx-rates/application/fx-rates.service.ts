import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import {
  FX_PROVIDERS,
  getFxProvider,
  type FxProviderKey,
} from '../domain/fx-providers';
import { fetchFrankfurterProvider, fetchNbpTableA } from './fx-fetch';

@Injectable()
export class FxRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ensureTables(tenantId: string) {
    for (const provider of FX_PROVIDERS) {
      await this.prisma.fxRateTable.upsert({
        where: {
          tenantId_providerKey: {
            tenantId,
            providerKey: provider.key,
          },
        },
        create: {
          tenantId,
          providerKey: provider.key,
          name: provider.name,
          description: provider.description,
          baseCurrency: provider.baseCurrency,
          sourceUrl: provider.sourceUrl,
        },
        update: {
          name: provider.name,
          description: provider.description,
          baseCurrency: provider.baseCurrency,
          sourceUrl: provider.sourceUrl,
        },
      });
    }
  }

  async list(tenantId: string) {
    await this.ensureTables(tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { activeFxTableId: true },
    });
    const tables = await this.prisma.fxRateTable.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return {
      providers: FX_PROVIDERS.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        baseCurrency: p.baseCurrency,
        sourceUrl: p.sourceUrl,
      })),
      activeFxTableId: tenant.activeFxTableId,
      tables: tables.map((t) => ({
        ...t,
        isActive: t.id === tenant.activeFxTableId,
        asOfDate: t.asOfDate?.toISOString().slice(0, 10) ?? null,
        lastSyncedAt: t.lastSyncedAt?.toISOString() ?? null,
      })),
    };
  }

  async getTable(tenantId: string, tableId: string) {
    await this.ensureTables(tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { activeFxTableId: true },
    });
    const table = await this.prisma.fxRateTable.findFirst({
      where: { id: tableId, tenantId },
    });
    if (!table) throw new NotFoundException('FX rate table not found');
    const rates = await this.prisma.fxRate.findMany({
      where: { tenantId, tableId },
      orderBy: { quoteCurrency: 'asc' },
    });
    return {
      ...table,
      isActive: table.id === tenant.activeFxTableId,
      asOfDate: table.asOfDate?.toISOString().slice(0, 10) ?? null,
      lastSyncedAt: table.lastSyncedAt?.toISOString() ?? null,
      rates: rates.map((r) => ({
        id: r.id,
        baseCurrency: r.baseCurrency,
        quoteCurrency: r.quoteCurrency,
        rate: Number(r.rate),
        /** Inverse: units of base per 1 quote (e.g. PLN per 1 USD for NBP). */
        inverseRate: Number(r.rate) === 0 ? null : 1 / Number(r.rate),
        asOfDate: r.asOfDate.toISOString().slice(0, 10),
      })),
    };
  }

  async setActive(tenantId: string, tableId: string, actorId?: string) {
    const table = await this.prisma.fxRateTable.findFirst({
      where: { id: tableId, tenantId },
    });
    if (!table) throw new NotFoundException('FX rate table not found');
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { activeFxTableId: tableId },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'fx_table.activate',
      entityType: 'FxRateTable',
      entityId: tableId,
      meta: { providerKey: table.providerKey, name: table.name },
    });
    return this.list(tenantId);
  }

  async sync(
    tenantId: string,
    providerKey: string,
    actorId?: string,
  ) {
    const meta = getFxProvider(providerKey);
    if (!meta) {
      throw new BadRequestException(
        `Unknown FX provider "${providerKey}". Supported: ${FX_PROVIDERS.map((p) => p.key).join(', ')}`,
      );
    }
    await this.ensureTables(tenantId);
    const table = await this.prisma.fxRateTable.findUniqueOrThrow({
      where: {
        tenantId_providerKey: {
          tenantId,
          providerKey: meta.key as FxProviderKey,
        },
      },
    });

    try {
      const fetched =
        meta.fetchMode === 'nbp'
          ? await fetchNbpTableA()
          : await fetchFrankfurterProvider(
              meta.frankfurterProvider!,
              meta.baseCurrency,
            );

      await this.prisma.$transaction(async (tx) => {
        await tx.fxRate.deleteMany({ where: { tableId: table.id } });
        if (fetched.rates.length) {
          await tx.fxRate.createMany({
            data: fetched.rates.map((r) => ({
              tenantId,
              tableId: table.id,
              baseCurrency: r.baseCurrency,
              quoteCurrency: r.quoteCurrency,
              rate: new Prisma.Decimal(r.rate.toFixed(8)),
              asOfDate: new Date(`${r.asOfDate}T00:00:00.000Z`),
            })),
          });
        }
        await tx.fxRateTable.update({
          where: { id: table.id },
          data: {
            asOfDate: new Date(`${fetched.asOfDate}T00:00:00.000Z`),
            lastSyncedAt: new Date(),
            lastSyncError: null,
            rateCount: fetched.rates.length,
          },
        });
      });

      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { activeFxTableId: true },
      });
      if (!tenant.activeFxTableId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { activeFxTableId: table.id },
        });
      }

      await this.audit.record({
        tenantId,
        actorId,
        action: 'fx_table.sync',
        entityType: 'FxRateTable',
        entityId: table.id,
        meta: {
          providerKey: meta.key,
          rateCount: fetched.rates.length,
          asOfDate: fetched.asOfDate,
          sourceLabel: fetched.sourceLabel,
        },
      });

      return this.getTable(tenantId, table.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.fxRateTable.update({
        where: { id: table.id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncError: message.slice(0, 500),
        },
      });
      throw new BadRequestException(`FX sync failed: ${message}`);
    }
  }

  async syncAll(tenantId: string, actorId?: string) {
    const results: Array<{
      providerKey: string;
      ok: boolean;
      error?: string;
      rateCount?: number;
    }> = [];
    for (const provider of FX_PROVIDERS) {
      try {
        const table = await this.sync(tenantId, provider.key, actorId);
        results.push({
          providerKey: provider.key,
          ok: true,
          rateCount: table.rates.length,
        });
      } catch (err) {
        results.push({
          providerKey: provider.key,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const list = await this.list(tenantId);
    return { ...list, syncResults: results };
  }
}
