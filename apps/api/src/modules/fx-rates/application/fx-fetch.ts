export const FX_HISTORY_START = '2020-01-01';

export type FetchedFxRate = {
  baseCurrency: string;
  quoteCurrency: string;
  /** Units of quote per 1 unit of base. */
  rate: number;
  asOfDate: string; // YYYY-MM-DD
};

export type FetchResult = {
  rates: FetchedFxRate[];
  asOfDate: string;
  fromDate: string;
  toDate: string;
  sourceLabel: string;
};

type NbpTableResponse = Array<{
  table: string;
  no: string;
  effectiveDate: string;
  rates: Array<{ currency: string; code: string; mid: number }>;
}>;

type FrankfurterRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

const FRANKFURTER = 'https://api.frankfurter.dev/v2';
/** NBP allows at most 93 days per tables range query. */
const NBP_CHUNK_DAYS = 90;
/** Frankfurter is happy with ~1 year chunks. */
const FRANK_CHUNK_DAYS = 366;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `FX fetch failed (${res.status}) ${url}: ${body.slice(0, 200)}`,
    );
  }
  return res.json() as Promise<T>;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

function todayUtc(): string {
  return toIsoDate(new Date());
}

function* dateChunks(
  from: string,
  to: string,
  chunkDays: number,
): Generator<{ from: string; to: string }> {
  let cursor = from;
  while (cursor <= to) {
    const end = minIso(addDays(cursor, chunkDays - 1), to);
    yield { from: cursor, to: end };
    cursor = addDays(end, 1);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNbpTableRange(
  from: string,
  to: string,
): Promise<FetchedFxRate[]> {
  const url = `https://api.nbp.pl/api/exchangerates/tables/A/${from}/${to}/?format=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  // NBP returns 404 when no business days in range (weekends/holidays).
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `FX fetch failed (${res.status}) ${url}: ${body.slice(0, 200)}`,
    );
  }
  const rows = (await res.json()) as NbpTableResponse;
  const out: FetchedFxRate[] = [];
  for (const table of rows) {
    const asOfDate = table.effectiveDate;
    for (const r of table.rates ?? []) {
      if (!r.code || !(r.mid > 0)) continue;
      out.push({
        baseCurrency: 'PLN',
        quoteCurrency: r.code.toUpperCase(),
        rate: 1 / r.mid,
        asOfDate,
      });
    }
    out.push({
      baseCurrency: 'PLN',
      quoteCurrency: 'PLN',
      rate: 1,
      asOfDate,
    });
  }
  return out;
}

/** NBP Table A history — mid is PLN per 1 foreign → store quote per 1 PLN. */
export async function fetchNbpHistory(
  from: string,
  to: string,
): Promise<FetchResult> {
  const start = maxIso(from, FX_HISTORY_START);
  const end = minIso(to, todayUtc());
  if (start > end) {
    return {
      rates: [],
      asOfDate: end,
      fromDate: start,
      toDate: end,
      sourceLabel: 'NBP',
    };
  }
  const rates: FetchedFxRate[] = [];
  for (const chunk of dateChunks(start, end, NBP_CHUNK_DAYS)) {
    const part = await fetchNbpTableRange(chunk.from, chunk.to);
    rates.push(...part);
    await sleep(80);
  }
  const asOfDate = rates.reduce(
    (max, r) => (r.asOfDate > max ? r.asOfDate : max),
    end,
  );
  return {
    rates,
    asOfDate,
    fromDate: start,
    toDate: end,
    sourceLabel: 'NBP Table A',
  };
}

export async function fetchFrankfurterHistory(
  providerKey: string,
  baseCurrency: string,
  from: string,
  to: string,
  quotes?: string[],
): Promise<FetchResult> {
  const start = maxIso(from, FX_HISTORY_START);
  const end = minIso(to, todayUtc());
  if (start > end) {
    return {
      rates: [],
      asOfDate: end,
      fromDate: start,
      toDate: end,
      sourceLabel: `Frankfurter ${providerKey}`,
    };
  }
  const base = baseCurrency.toUpperCase();
  const quoteParam = quotes?.length
    ? `&quotes=${encodeURIComponent(
        [...new Set([...quotes.map((q) => q.toUpperCase()), base])].join(','),
      )}`
    : '';
  const rates: FetchedFxRate[] = [];
  for (const chunk of dateChunks(start, end, FRANK_CHUNK_DAYS)) {
    const url =
      `${FRANKFURTER}/rates?providers=${encodeURIComponent(providerKey)}` +
      `&base=${encodeURIComponent(base)}` +
      `&from=${chunk.from}&to=${chunk.to}${quoteParam}`;
    const rows = await fetchJson<FrankfurterRate[]>(url);
    for (const r of rows) {
      if (!r.quote || !(r.rate > 0)) continue;
      rates.push({
        baseCurrency: r.base.toUpperCase(),
        quoteCurrency: r.quote.toUpperCase(),
        rate: r.rate,
        asOfDate: r.date,
      });
    }
    await sleep(50);
  }
  const dates = new Set(rates.map((r) => r.asOfDate));
  for (const d of dates) {
    if (![...rates].some((r) => r.asOfDate === d && r.quoteCurrency === base)) {
      rates.push({
        baseCurrency: base,
        quoteCurrency: base,
        rate: 1,
        asOfDate: d,
      });
    }
  }
  const asOfDate = rates.reduce(
    (max, r) => (r.asOfDate > max ? r.asOfDate : max),
    end,
  );
  return {
    rates,
    asOfDate,
    fromDate: start,
    toDate: end,
    sourceLabel: `Frankfurter ${providerKey}`,
  };
}

/** Latest published snapshot (single day). */
export async function fetchNbpLatest(): Promise<FetchResult> {
  const end = todayUtc();
  const start = addDays(end, -14);
  const result = await fetchNbpHistory(start, end);
  if (!result.rates.length) {
    throw new Error('NBP returned no recent Table A rates');
  }
  const latest = result.rates.reduce(
    (max, r) => (r.asOfDate > max ? r.asOfDate : max),
    result.rates[0]!.asOfDate,
  );
  return {
    ...result,
    rates: result.rates.filter((r) => r.asOfDate === latest),
    asOfDate: latest,
    fromDate: latest,
    toDate: latest,
  };
}

export async function fetchFrankfurterLatest(
  providerKey: string,
  baseCurrency: string,
  quotes?: string[],
): Promise<FetchResult> {
  const end = todayUtc();
  const start = addDays(end, -14);
  const result = await fetchFrankfurterHistory(
    providerKey,
    baseCurrency,
    start,
    end,
    quotes,
  );
  if (!result.rates.length) {
    throw new Error(`Frankfurter returned no recent rates for ${providerKey}`);
  }
  const latest = result.rates.reduce(
    (max, r) => (r.asOfDate > max ? r.asOfDate : max),
    result.rates[0]!.asOfDate,
  );
  return {
    ...result,
    rates: result.rates.filter((r) => r.asOfDate === latest),
    asOfDate: latest,
    fromDate: latest,
    toDate: latest,
  };
}

export { addDays, todayUtc, maxIso, minIso };
