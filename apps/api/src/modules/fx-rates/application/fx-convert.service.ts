import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { getFxProvider } from '../domain/fx-providers';

export type ConvertInput = {
  amountMinor: number;
  currency: string;
  asOfDate: string; // YYYY-MM-DD
  entityId?: string | null;
  /** Override entity defaults */
  toCurrency?: string;
  providerKey?: string;
};

export type ConvertResult = {
  amountMinor: number;
  currency: string;
  originalAmountMinor: number;
  originalCurrency: string;
  asOfDate: string;
  rateDate: string | null;
  providerKey: string | null;
  rateUsed: number | null;
  converted: boolean;
  unavailableReason?: string;
};

@Injectable()
export class FxConvertService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDefaults(
    tenantId: string,
    entityId?: string | null,
  ): Promise<{
    currency: string;
    providerKey: string;
    tableId: string | null;
    baseCurrency: string | null;
  }> {
    let currency = 'EUR';
    let providerKey = 'ecb';

    if (entityId) {
      const entity = await this.prisma.entity.findFirst({
        where: { id: entityId, tenantId },
      });
      if (entity) {
        currency = entity.defaultCurrency || 'EUR';
        providerKey = entity.fxProviderKey || 'ecb';
      }
    } else {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          activeFxTableId: true,
          activeFxTable: { select: { providerKey: true, baseCurrency: true } },
        },
      });
      if (tenant?.activeFxTable) {
        providerKey = tenant.activeFxTable.providerKey;
        currency = tenant.activeFxTable.baseCurrency;
      }
    }

    const table = await this.prisma.fxRateTable.findUnique({
      where: {
        tenantId_providerKey: { tenantId, providerKey },
      },
    });

    return {
      currency,
      providerKey,
      tableId: table?.id ?? null,
      baseCurrency: table?.baseCurrency ?? getFxProvider(providerKey)?.baseCurrency ?? null,
    };
  }

  /** Rate = units of quote per 1 base, on or before asOfDate. */
  async rateOnOrBefore(
    tableId: string,
    quoteCurrency: string,
    asOfDate: string,
  ): Promise<{ rate: number; rateDate: string } | null> {
    const quote = quoteCurrency.toUpperCase();
    const row = await this.prisma.fxRate.findFirst({
      where: {
        tableId,
        quoteCurrency: quote,
        asOfDate: { lte: new Date(`${asOfDate}T00:00:00.000Z`) },
      },
      orderBy: { asOfDate: 'desc' },
    });
    if (!row) return null;
    return {
      rate: Number(row.rate),
      rateDate: row.asOfDate.toISOString().slice(0, 10),
    };
  }

  /**
   * Convert amount in `from` to `to` using table rates (quote per 1 base).
   * amount_to = amount_from * (rate_to / rate_from)
   */
  async convertOne(
    tenantId: string,
    input: ConvertInput,
  ): Promise<ConvertResult> {
    const originalCurrency = (input.currency || 'EUR').toUpperCase();
    const originalAmountMinor = Math.round(input.amountMinor);
    const asOfDate = input.asOfDate || new Date().toISOString().slice(0, 10);

    const defaults = await this.resolveDefaults(tenantId, input.entityId);
    const toCurrency = (
      input.toCurrency ||
      defaults.currency ||
      'EUR'
    ).toUpperCase();
    const providerKey = (
      input.providerKey ||
      defaults.providerKey ||
      'ecb'
    ).toLowerCase();

    const base: ConvertResult = {
      amountMinor: originalAmountMinor,
      currency: toCurrency,
      originalAmountMinor,
      originalCurrency,
      asOfDate,
      rateDate: null,
      providerKey,
      rateUsed: null,
      converted: false,
    };

    if (originalCurrency === toCurrency) {
      return { ...base, converted: true, rateUsed: 1, rateDate: asOfDate };
    }

    const table =
      defaults.tableId && defaults.providerKey === providerKey
        ? { id: defaults.tableId, baseCurrency: defaults.baseCurrency! }
        : await this.prisma.fxRateTable.findUnique({
            where: {
              tenantId_providerKey: { tenantId, providerKey },
            },
          });

    if (!table) {
      return {
        ...base,
        unavailableReason: `FX table "${providerKey}" not synced`,
      };
    }

    const baseCurrency = (
      'baseCurrency' in table ? table.baseCurrency : defaults.baseCurrency
    )?.toUpperCase();
    if (!baseCurrency) {
      return { ...base, unavailableReason: 'FX base currency unknown' };
    }

    const fromRate =
      originalCurrency === baseCurrency
        ? { rate: 1, rateDate: asOfDate }
        : await this.rateOnOrBefore(table.id, originalCurrency, asOfDate);
    const toRate =
      toCurrency === baseCurrency
        ? { rate: 1, rateDate: asOfDate }
        : await this.rateOnOrBefore(table.id, toCurrency, asOfDate);

    if (!fromRate || fromRate.rate === 0) {
      return {
        ...base,
        unavailableReason: `No ${providerKey} rate for ${originalCurrency} on/before ${asOfDate}`,
      };
    }
    if (!toRate) {
      return {
        ...base,
        unavailableReason: `No ${providerKey} rate for ${toCurrency} on/before ${asOfDate}`,
      };
    }

    const cross = toRate.rate / fromRate.rate;
    const convertedMinor = Math.round(originalAmountMinor * cross);
    const rateDate =
      fromRate.rateDate <= toRate.rateDate ? fromRate.rateDate : toRate.rateDate;

    return {
      amountMinor: convertedMinor,
      currency: toCurrency,
      originalAmountMinor,
      originalCurrency,
      asOfDate,
      rateDate,
      providerKey,
      rateUsed: cross,
      converted: true,
    };
  }

  async convertMany(
    tenantId: string,
    items: Array<ConvertInput & { id: string }>,
  ): Promise<Array<ConvertResult & { id: string }>> {
    const out: Array<ConvertResult & { id: string }> = [];
    for (const item of items) {
      const result = await this.convertOne(tenantId, item);
      out.push({ id: item.id, ...result });
    }
    return out;
  }

  async attachReporting<
    T extends {
      id: string;
      currency?: string | null;
      entityId?: string | null;
    },
  >(
    tenantId: string,
    rows: T[],
    opts: {
      amount: (row: T) => number | null | undefined;
      asOfDate: (row: T) => string | Date | null | undefined;
    },
  ): Promise<
    Array<
      T & {
        reporting: ConvertResult | null;
      }
    >
  > {
    const result: Array<T & { reporting: ConvertResult | null }> = [];
    for (const row of rows) {
      const amount = opts.amount(row);
      if (amount == null) {
        result.push({ ...row, reporting: null });
        continue;
      }
      const rawDate = opts.asOfDate(row);
      const asOfDate =
        rawDate instanceof Date
          ? rawDate.toISOString().slice(0, 10)
          : (rawDate ?? new Date().toISOString().slice(0, 10));
      const reporting = await this.convertOne(tenantId, {
        amountMinor: amount,
        currency: row.currency ?? 'EUR',
        asOfDate,
        entityId: row.entityId,
      });
      result.push({ ...row, reporting });
    }
    return result;
  }
}
