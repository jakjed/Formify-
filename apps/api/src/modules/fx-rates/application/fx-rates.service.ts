import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CURRENCY_CODES } from '@aptora/types';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import {
  FX_PROVIDERS,
  getFxProvider,
  type FxProviderKey,
} from '../domain/fx-providers';
import {
  FX_HISTORY_START,
  addDays,
  fetchFrankfurterHistory,
  fetchNbpHistory,
  maxIso,
  minIso,
  todayUtc,
} from './fx-fetch';

export type FxRateQuery = {
  year?: number;
  month?: number;
  day?: number;
  quote?: string;
  limit?: number;
};

@Injectable()
export class FxRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private frankfurterQuotes(base: string): string[] {
    return CURRENCY_CODES.filter((c) => c !== base);
  }

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
      historyStart: FX_HISTORY_START,
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
        earliestDate: t.earliestDate?.toISOString().slice(0, 10) ?? null,
        lastSyncedAt: t.lastSyncedAt?.toISOString() ?? null,
      })),
    };
  }

  private dateFilter(query: FxRateQuery): Prisma.DateTimeFilter | undefined {
    const { year, month, day } = query;
    if (year == null && month == null && day == null) return undefined;
    if (year != null && month != null && day != null) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { equals: new Date(`${iso}T00:00:00.000Z`) };
    }
    if (year != null && month != null) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return { gte: start, lte: end };
    }
    if (year != null) {
      return {
        gte: new Date(Date.UTC(year, 0, 1)),
        lte: new Date(Date.UTC(year, 11, 31)),
      };
    }
    throw new BadRequestException(
      'month/day filters require year (and day requires month)',
    );
  }

  async getTable(tenantId: string, tableId: string, query: FxRateQuery = {}) {
    await this.ensureTables(tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { activeFxTableId: true },
    });
    const table = await this.prisma.fxRateTable.findFirst({
      where: { id: tableId, tenantId },
    });
    if (!table) throw new NotFoundException('FX rate table not found');

    const dateWhere = this.dateFilter(query);
    const quote = query.quote?.trim().toUpperCase();
    const where: Prisma.FxRateWhereInput = {
      tenantId,
      tableId,
      ...(dateWhere ? { asOfDate: dateWhere } : {}),
      ...(quote ? { quoteCurrency: { contains: quote, mode: 'insensitive' } } : {}),
    };

    // Default view: latest available date when no date filter provided
    let effectiveWhere = where;
    let selectedDate: string | null = null;
    if (!dateWhere) {
      const latest = await this.prisma.fxRate.findFirst({
        where: { tenantId, tableId },
        orderBy: { asOfDate: 'desc' },
        select: { asOfDate: true },
      });
      if (latest) {
        selectedDate = latest.asOfDate.toISOString().slice(0, 10);
        effectiveWhere = {
          ...where,
          asOfDate: latest.asOfDate,
        };
      }
    } else if (query.year != null && query.month != null && query.day != null) {
      selectedDate = `${query.year}-${String(query.month).padStart(2, '0')}-${String(query.day).padStart(2, '0')}`;
    }

    const limit = Math.min(Math.max(query.limit ?? 2000, 1), 5000);
    const [rates, total, dateRows] = await Promise.all([
      this.prisma.fxRate.findMany({
        where: effectiveWhere,
        orderBy: [{ asOfDate: 'desc' }, { quoteCurrency: 'asc' }],
        take: limit,
      }),
      this.prisma.fxRate.count({ where: effectiveWhere }),
      this.prisma.fxRate.findMany({
        where: { tenantId, tableId },
        distinct: ['asOfDate'],
        select: { asOfDate: true },
        orderBy: { asOfDate: 'desc' },
      }),
    ]);

    const availableDates = dateRows.map((r) =>
      r.asOfDate.toISOString().slice(0, 10),
    );
    const years = [
      ...new Set(availableDates.map((d) => Number(d.slice(0, 4)))),
    ].sort((a, b) => b - a);
    const monthsForYear =
      query.year != null
        ? [
            ...new Set(
              availableDates
                .filter((d) => d.startsWith(`${query.year}-`))
                .map((d) => Number(d.slice(5, 7))),
            ),
          ].sort((a, b) => a - b)
        : [];
    const daysForMonth =
      query.year != null && query.month != null
        ? [
            ...new Set(
              availableDates
                .filter((d) =>
                  d.startsWith(
                    `${query.year}-${String(query.month).padStart(2, '0')}-`,
                  ),
                )
                .map((d) => Number(d.slice(8, 10))),
            ),
          ].sort((a, b) => a - b)
        : [];

    return {
      ...table,
      isActive: table.id === tenant.activeFxTableId,
      asOfDate: table.asOfDate?.toISOString().slice(0, 10) ?? null,
      earliestDate: table.earliestDate?.toISOString().slice(0, 10) ?? null,
      lastSyncedAt: table.lastSyncedAt?.toISOString() ?? null,
      historyStart: FX_HISTORY_START,
      filters: {
        year: query.year ?? null,
        month: query.month ?? null,
        day: query.day ?? null,
        quote: quote ?? null,
        selectedDate,
        availableYears: years,
        availableMonths: monthsForYear,
        availableDays: daysForMonth,
      },
      total,
      truncated: total > rates.length,
      rates: rates.map((r) => ({
        id: r.id,
        baseCurrency: r.baseCurrency,
        quoteCurrency: r.quoteCurrency,
        rate: Number(r.rate),
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

  private async persistRates(
    tenantId: string,
    tableId: string,
    rates: Array<{
      baseCurrency: string;
      quoteCurrency: string;
      rate: number;
      asOfDate: string;
    }>,
  ) {
    if (!rates.length) return 0;
    // Batch inserts to avoid huge payloads
    const batchSize = 1000;
    let inserted = 0;
    for (let i = 0; i < rates.length; i += batchSize) {
      const slice = rates.slice(i, i + batchSize);
      const result = await this.prisma.fxRate.createMany({
        data: slice.map((r) => ({
          tenantId,
          tableId,
          baseCurrency: r.baseCurrency,
          quoteCurrency: r.quoteCurrency,
          rate: new Prisma.Decimal(r.rate.toFixed(8)),
          asOfDate: new Date(`${r.asOfDate}T00:00:00.000Z`),
        })),
        skipDuplicates: true,
      });
      inserted += result.count;
    }
    return inserted;
  }

  private async refreshTableStats(tableId: string) {
    const agg = await this.prisma.fxRate.aggregate({
      where: { tableId },
      _min: { asOfDate: true },
      _max: { asOfDate: true },
      _count: true,
    });
    await this.prisma.fxRateTable.update({
      where: { id: tableId },
      data: {
        earliestDate: agg._min.asOfDate ?? null,
        asOfDate: agg._max.asOfDate ?? null,
        rateCount: agg._count,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
  }

  /**
   * Sync strategy:
   * - If table empty → backfill from 2020-01-01 to today
   * - Else → fill from day after latest stored date to today (incremental)
   * - Optional `backfill: true` forces gap fill from 2020 to earliest-1 as well
   */
  async sync(
    tenantId: string,
    providerKey: string,
    actorId?: string,
    opts?: { backfill?: boolean },
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
      const agg = await this.prisma.fxRate.aggregate({
        where: { tableId: table.id },
        _min: { asOfDate: true },
        _max: { asOfDate: true },
      });
      const earliest = agg._min.asOfDate
        ? agg._min.asOfDate.toISOString().slice(0, 10)
        : null;
      const latest = agg._max.asOfDate
        ? agg._max.asOfDate.toISOString().slice(0, 10)
        : null;
      const end = todayUtc();

      const ranges: Array<{ from: string; to: string }> = [];
      if (!latest) {
        ranges.push({ from: FX_HISTORY_START, to: end });
      } else {
        const next = addDays(latest, 1);
        if (next <= end) ranges.push({ from: next, to: end });
        if (opts?.backfill && earliest && earliest > FX_HISTORY_START) {
          ranges.push({
            from: FX_HISTORY_START,
            to: addDays(earliest, -1),
          });
        }
        if (opts?.backfill && !earliest) {
          ranges.push({ from: FX_HISTORY_START, to: end });
        }
      }

      let inserted = 0;
      let fetched = 0;
      let coverFrom = latest ?? FX_HISTORY_START;
      let coverTo = latest ?? FX_HISTORY_START;

      for (const range of ranges) {
        if (range.from > range.to) continue;
        const result =
          meta.fetchMode === 'nbp'
            ? await fetchNbpHistory(range.from, range.to)
            : await fetchFrankfurterHistory(
                meta.frankfurterProvider!,
                meta.baseCurrency,
                range.from,
                range.to,
                this.frankfurterQuotes(meta.baseCurrency),
              );
        fetched += result.rates.length;
        inserted += await this.persistRates(tenantId, table.id, result.rates);
        coverFrom = minIso(coverFrom, range.from);
        coverTo = maxIso(coverTo, range.to);
      }

      // Always refresh latest day window so today's publish is picked up even if
      // latest == today (re-publish / corrections).
      {
        const recentFrom = addDays(end, -7);
        const recent =
          meta.fetchMode === 'nbp'
            ? await fetchNbpHistory(recentFrom, end)
            : await fetchFrankfurterHistory(
                meta.frankfurterProvider!,
                meta.baseCurrency,
                recentFrom,
                end,
                this.frankfurterQuotes(meta.baseCurrency),
              );
        fetched += recent.rates.length;
        inserted += await this.persistRates(tenantId, table.id, recent.rates);
      }

      await this.refreshTableStats(table.id);

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
          fetched,
          inserted,
          coverFrom,
          coverTo,
          backfill: Boolean(opts?.backfill),
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

  async syncAll(
    tenantId: string,
    actorId?: string,
    opts?: { backfill?: boolean },
  ) {
    const results: Array<{
      providerKey: string;
      ok: boolean;
      error?: string;
      rateCount?: number;
      earliestDate?: string | null;
      asOfDate?: string | null;
    }> = [];
    for (const provider of FX_PROVIDERS) {
      try {
        const table = await this.sync(
          tenantId,
          provider.key,
          actorId,
          opts,
        );
        results.push({
          providerKey: provider.key,
          ok: true,
          rateCount: table.rateCount,
          earliestDate: table.earliestDate,
          asOfDate: table.asOfDate,
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
