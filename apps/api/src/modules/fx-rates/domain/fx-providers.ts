/** Free official FX sources — no API keys required. */

export type FxProviderKey = 'nbp' | 'ecb' | 'fred' | 'boe';

export type FxProviderMeta = {
  key: FxProviderKey;
  name: string;
  description: string;
  baseCurrency: string;
  sourceUrl: string;
  /** How we fetch rates for this provider. */
  fetchMode: 'nbp' | 'frankfurter';
  frankfurterProvider?: string;
};

export const FX_PROVIDERS: FxProviderMeta[] = [
  {
    key: 'nbp',
    name: 'Polish NBP (Table A)',
    description:
      'Narodowy Bank Polski mid rates — official for Polish VAT/CIT FX conversion. Base PLN.',
    baseCurrency: 'PLN',
    sourceUrl: 'https://api.nbp.pl',
    fetchMode: 'nbp',
  },
  {
    key: 'ecb',
    name: 'ECB reference',
    description:
      'European Central Bank euro foreign exchange reference rates. Base EUR. (Often requested as “CBOE”; CBOE does not publish a free mid-rate API — ECB is the EU official table.)',
    baseCurrency: 'EUR',
    sourceUrl: 'https://www.ecb.europa.eu/stats/eurofxref/',
    fetchMode: 'frankfurter',
    frankfurterProvider: 'ECB',
  },
  {
    key: 'fred',
    name: 'US Fed (H.10)',
    description:
      'Federal Reserve Board H.10 foreign exchange rates via FRED. Base USD.',
    baseCurrency: 'USD',
    sourceUrl: 'https://fred.stlouisfed.org/',
    fetchMode: 'frankfurter',
    frankfurterProvider: 'FRED',
  },
  {
    key: 'boe',
    name: 'Bank of England',
    description: 'Bank of England spot exchange rates. Base GBP.',
    baseCurrency: 'GBP',
    sourceUrl: 'https://www.bankofengland.co.uk/',
    fetchMode: 'frankfurter',
    frankfurterProvider: 'BOE',
  },
];

export function getFxProvider(key: string): FxProviderMeta | undefined {
  return FX_PROVIDERS.find((p) => p.key === key);
}
