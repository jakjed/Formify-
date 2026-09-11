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

/** NBP Table A: mid is PLN per 1 foreign unit → store as quote/base with base=PLN. */
export async function fetchNbpTableA(): Promise<FetchResult> {
  const rows = await fetchJson<NbpTableResponse>(
    'https://api.nbp.pl/api/exchangerates/tables/A?format=json',
  );
  const table = rows[0];
  if (!table?.rates?.length) {
    throw new Error('NBP returned an empty Table A');
  }
  const asOfDate = table.effectiveDate;
  const rates: FetchedFxRate[] = table.rates
    .filter((r) => r.code && r.mid > 0)
    .map((r) => ({
      baseCurrency: 'PLN',
      quoteCurrency: r.code.toUpperCase(),
      // mid = PLN per 1 foreign → foreign per 1 PLN
      rate: 1 / r.mid,
      asOfDate,
    }));
  rates.push({
    baseCurrency: 'PLN',
    quoteCurrency: 'PLN',
    rate: 1,
    asOfDate,
  });
  return {
    rates,
    asOfDate,
    sourceLabel: `NBP ${table.no}`,
  };
}

export async function fetchFrankfurterProvider(
  providerKey: string,
  baseCurrency: string,
): Promise<FetchResult> {
  const url = `${FRANKFURTER}/rates?providers=${encodeURIComponent(providerKey)}&base=${encodeURIComponent(baseCurrency)}`;
  const rows = await fetchJson<FrankfurterRate[]>(url);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Frankfurter returned no rates for ${providerKey}`);
  }
  const asOfDate = rows.reduce(
    (max, r) => (r.date > max ? r.date : max),
    rows[0]!.date,
  );
  const rates: FetchedFxRate[] = rows
    .filter((r) => r.quote && r.rate > 0)
    .map((r) => ({
      baseCurrency: r.base.toUpperCase(),
      quoteCurrency: r.quote.toUpperCase(),
      rate: r.rate,
      asOfDate: r.date,
    }));
  if (!rates.some((r) => r.quoteCurrency === baseCurrency.toUpperCase())) {
    rates.push({
      baseCurrency: baseCurrency.toUpperCase(),
      quoteCurrency: baseCurrency.toUpperCase(),
      rate: 1,
      asOfDate,
    });
  }
  return {
    rates,
    asOfDate,
    sourceLabel: `Frankfurter ${providerKey}`,
  };
}
