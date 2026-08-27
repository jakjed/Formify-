import type { ReactNode } from 'react';
import type { StatusTone } from './status';
import { invoiceStatusLabel, invoiceStatusTone } from './status';

export function StatusBadge({
  tone,
  children,
  title,
}: {
  tone: StatusTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`status-badge status-badge--${tone}`} title={title}>
      <span className="status-badge__dot" aria-hidden />
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={invoiceStatusTone(status)}>
      {invoiceStatusLabel(status)}
    </StatusBadge>
  );
}
