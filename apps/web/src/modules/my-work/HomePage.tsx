import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch } from '../../shared/lib/api';

type Health = {
  status: string;
  product: string;
  phase1Modules: string[];
  database?: string;
  timestamp: string;
};

type Usage = {
  approvedInvoices: number;
  ocrPagesThisMonth: number;
  yearMonth: string;
};

type ApprovalTask = {
  id: string;
  invoiceId: string;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    vendorNameRaw: string | null;
    totalMinor: number | null;
    currency: string;
    status: string;
  } | null;
};

type Policy = {
  name: string;
  enabled: boolean;
  autoApproveUnderMinor: number | null;
};

function money(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

function ageLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

export function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [h, u, t, p] = await Promise.all([
      fetch('/api/health').then((r) => r.json() as Promise<Health>),
      apiFetch<Usage>('/api/usage/summary'),
      apiFetch<ApprovalTask[]>('/api/approvals/my-work'),
      apiFetch<Policy>('/api/workflow/policy'),
    ]);
    setHealth(h);
    setUsage(u);
    setTasks(t);
    setPolicy(p);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function decide(taskId: string, decision: 'approve' | 'reject') {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/approvals/${taskId}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage(decision === 'approve' ? 'Approved' : 'Rejected');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <section className="page page--cockpit">
      <header className="cockpit-hero">
        <div>
          <p className="eyebrow">Today at {PRODUCT_NAME}</p>
          <h1>My Work</h1>
          <p className="lede">
            Approvals waiting on you — clear the queue, keep cash moving.
          </p>
        </div>
        <div className="cockpit-hero__actions">
          <Link className="btn btn--primary" to="/invoices">
            Open invoices
          </Link>
          <Link className="btn btn--ghost" to="/exceptions">
            Exceptions
          </Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="cockpit-stats">
        <article className="stat-orb stat-orb--teal">
          <p className="stat-orb__label">Pending</p>
          <p className="stat-orb__value">{tasks.length}</p>
          <p className="stat-orb__hint">
            {tasks.length === 0 ? 'queue clear' : 'needs your decision'}
          </p>
        </article>
        <article className="stat-orb stat-orb--amber">
          <p className="stat-orb__label">Billable</p>
          <p className="stat-orb__value">{usage?.approvedInvoices ?? '—'}</p>
          <p className="stat-orb__hint">approved invoices</p>
        </article>
        <article className="stat-orb stat-orb--sky">
          <p className="stat-orb__label">OCR</p>
          <p className="stat-orb__value">{usage?.ocrPagesThisMonth ?? '—'}</p>
          <p className="stat-orb__hint">pages · {usage?.yearMonth ?? '—'}</p>
        </article>
        <article className="stat-orb stat-orb--forest">
          <p className="stat-orb__label">System</p>
          <p className="stat-orb__value stat-orb__value--sm">
            <span
              className={`status-badge status-badge--${
                health?.status === 'ok' ? 'success' : 'warning'
              }`}
            >
              <span className="status-badge__dot" aria-hidden />
              {health?.status ?? '…'}
            </span>
          </p>
          <p className="stat-orb__hint">
            DB {health?.database ?? '…'}
            {policy?.enabled ? ' · policy on' : ''}
          </p>
        </article>
      </div>

      <div className="cockpit-queue panel panel--wide panel--lift">
        <div className="panel__head">
          <div>
            <h2>Pending approvals</h2>
            <p className="muted">Tap through or open the invoice workspace.</p>
          </div>
          {policy && (
            <span className="status-badge status-badge--warning">
              <span className="status-badge__dot" aria-hidden />
              Auto under{' '}
              {policy.autoApproveUnderMinor == null
                ? 'off'
                : money(policy.autoApproveUnderMinor, 'EUR')}
            </span>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__orb" aria-hidden />
            <h3>Queue clear</h3>
            <p className="muted">
              Nothing waiting on you. Capture a new invoice or review exceptions.
            </p>
            <div className="empty-state__actions">
              <Link className="btn btn--primary" to="/invoices">
                Go to invoices
              </Link>
            </div>
          </div>
        ) : (
          <ul className="approval-rail">
            {tasks.map((task, i) => (
              <li
                key={task.id}
                className="approval-card"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="approval-card__main">
                  <Link
                    className="approval-card__title"
                    to={`/invoices/${task.invoiceId}`}
                  >
                    {task.invoice?.invoiceNumber ?? 'Draft invoice'}
                  </Link>
                  <p className="approval-card__meta">
                    {task.invoice?.vendorNameRaw ?? 'Unknown vendor'}
                    <span className="approval-card__dot" />
                    {ageLabel(task.createdAt)}
                  </p>
                </div>
                <p className="approval-card__amount">
                  {money(
                    task.invoice?.totalMinor ?? null,
                    task.invoice?.currency ?? 'EUR',
                  )}
                </p>
                <div className="approval-card__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void decide(task.id, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => void decide(task.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
