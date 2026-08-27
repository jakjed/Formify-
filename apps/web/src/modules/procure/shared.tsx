import type { ReactNode } from 'react';
import { StatusBadge } from '../../shared/ui/StatusBadge';
import type { StatusTone } from '../../shared/ui/status';

export const CONTRACT_APPROVAL_CHAIN = [
  'Budget Owner',
  'Legal',
  'Tax',
  'Compliance',
  'Finance',
] as const;

export const PR_APPROVAL_CHAIN = [
  'Budget Owner',
  'Finance',
  'CFO',
] as const;

export const ACCRUAL_APPROVAL_CHAIN = ['AP Manager', 'Controller'] as const;

export const CLM_TOOLS = [
  'Conga',
  'Docusign CLM',
  'PandaDoc',
  'IronClad',
] as const;

export const DEPARTMENTS = [
  'G&A',
  'R&D',
  'Sales & Marketing',
  'Finance',
  'Operations',
] as const;

export const EXPENSE_CATEGORIES = [
  'Software & SaaS',
  'Professional Services',
  'Marketing',
  'Facilities',
  'Travel & Entertainment',
  'Consulting',
] as const;

export const DOC_CATEGORIES: { key: string; label: string }[] = [
  { key: 'draft', label: 'Contract draft' },
  { key: 'executed', label: 'Executed' },
  { key: 'correspondence', label: 'Correspondence' },
  { key: 'paymentForm', label: 'Payment form' },
  { key: 'misc', label: 'Misc' },
  { key: 'others', label: 'Other' },
];

const CONTRACT_STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  in_approval: 'warning',
  pending_signature: 'info',
  active: 'success',
  expired: 'neutral',
  cancelled: 'danger',
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_approval: 'Under approval',
  pending_signature: 'Pending signature',
  active: 'Signed / active',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const PR_STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  in_approval: 'warning',
  approved: 'success',
  converted: 'info',
  cancelled: 'danger',
};

const PO_STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  issued: 'info',
  partially_received: 'warning',
  received: 'success',
  closed: 'neutral',
  cancelled: 'danger',
};

const ACCRUAL_STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  in_approval: 'warning',
  approved: 'success',
  posted: 'info',
  cancelled: 'danger',
};

export function formatMoney(minor: number | null | undefined, currency = 'EUR') {
  if (minor == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(0)} ${currency}`;
  }
}

export function contractStatusTone(status: string): StatusTone {
  return CONTRACT_STATUS_TONE[status] ?? 'neutral';
}

export function contractStatusLabel(status: string) {
  return CONTRACT_STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

export function ContractStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={contractStatusTone(status)}>
      {contractStatusLabel(status)}
    </StatusBadge>
  );
}

export function PrStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={PR_STATUS_TONE[status] ?? 'neutral'}>
      {status.replace(/_/g, ' ')}
    </StatusBadge>
  );
}

export function PoStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={PO_STATUS_TONE[status] ?? 'neutral'}>
      {status.replace(/_/g, ' ')}
    </StatusBadge>
  );
}

export function AccrualStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={ACCRUAL_STATUS_TONE[status] ?? 'neutral'}>
      {status.replace(/_/g, ' ')}
    </StatusBadge>
  );
}

export function ProcureStepper({
  chain,
  stage,
}: {
  chain: readonly string[];
  stage: number;
}) {
  return (
    <div className="procure__stepper" role="list" aria-label="Approval progress">
      {chain.map((label, i) => {
        const idx = i + 1;
        const cls =
          idx < stage ? 'procure__step--done' : idx === stage ? 'procure__step--current' : '';
        return (
          <div key={label} className={`procure__step ${cls}`} role="listitem">
            <div className="procure__step-dot">{idx < stage ? '✓' : idx}</div>
            <div className="procure__step-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Full approval progress card matching the design: thick bar + stage stepper. */
export function ApprovalProgress({
  chain,
  stage,
  title = 'Approval progress',
  subtitle = 'Internal sign-off only — not an official signature.',
}: {
  chain: readonly string[];
  stage: number;
  title?: string;
  subtitle?: string;
}) {
  const total = Math.max(chain.length, 1);
  const completed = Math.max(0, Math.min(stage - 1, total));
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="procure__card approval-progress">
      <div className="procure__section-title">{title}</div>
      <p className="procure__section-desc">{subtitle}</p>
      <div className="approval-progress__track" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
      <ProcureStepper chain={chain} stage={stage} />
    </div>
  );
}

export function ProcureTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="procure__tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`procure__tab${value === tab.id ? ' procure__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count != null && (
            <span className="procure__tab-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ProcureKpis({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="procure__kpis">
      {items.map((item) => (
        <div key={item.label} className="procure__kpi">
          <div className="procure__kpi-label">{item.label}</div>
          <div className="procure__kpi-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="procure__bar" aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kv({
  rows,
}: {
  rows: { k: string; v: ReactNode }[];
}) {
  return (
    <div className="procure__kv">
      {rows.map((row) => (
        <div key={row.k} className="procure__kv-row">
          <span className="procure__kv-k">{row.k}</span>
          <span className="procure__kv-v">{row.v}</span>
        </div>
      ))}
    </div>
  );
}
