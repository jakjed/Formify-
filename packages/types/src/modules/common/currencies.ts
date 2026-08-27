/** ISO-4217 codes commonly used in AP. Extend as needed. */
export const CURRENCY_CODES = [
  'EUR',
  'USD',
  'GBP',
  'PLN',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'RON',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value.toUpperCase());
}

export function normalizeCurrency(value: string | null | undefined): CurrencyCode {
  const code = (value ?? 'EUR').toUpperCase();
  return isCurrencyCode(code) ? code : 'EUR';
}
