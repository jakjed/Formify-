import type { ReactNode } from 'react';
import { formatMoney as formatMoneyShared } from '../../modules/procure/shared';

export type ReportingMoney = {
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
} | null;

/** Document amount + entity reporting currency conversion (when different). */
export function MoneyAmount({
  amountMinor,
  currency,
  reporting,
  empty = '—',
}: {
  amountMinor: number | null | undefined;
  currency: string;
  reporting?: ReportingMoney;
  empty?: ReactNode;
}) {
  if (amountMinor == null) return <>{empty}</>;
  const original = formatMoneyShared(amountMinor, currency);
  if (
    !reporting ||
    !reporting.converted ||
    reporting.currency.toUpperCase() === currency.toUpperCase()
  ) {
    return <span>{original}</span>;
  }
  const converted = formatMoneyShared(reporting.amountMinor, reporting.currency);
  const tip = [
    reporting.providerKey ? `FX ${reporting.providerKey.toUpperCase()}` : null,
    reporting.rateDate ? `rate date ${reporting.rateDate}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span title={tip || undefined}>
      {original}
      <span className="muted"> · {converted}</span>
    </span>
  );
}
