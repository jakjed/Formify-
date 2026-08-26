/** Money stored as integer minor units + ISO currency. */
export type Money = {
  amountMinor: number;
  currency: string;
};

export function formatMoney(money: Money, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(money.amountMinor / 100);
}
