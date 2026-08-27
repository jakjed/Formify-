import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_NAME, PHASE1_MODULES } from '@aptora/types';
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
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
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
    <section className="page">
      <p className="eyebrow">Phase 1</p>
      <h1>My Work</h1>
      <p className="lede">
        {PRODUCT_NAME} approvals inbox. Modules: {PHASE1_MODULES.join(', ')}.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="panel">
        <h2>Pending approvals</h2>
        {tasks.length === 0 && <p className="muted">No open tasks.</p>}
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <div>
                <Link to={`/invoices/${task.invoiceId}`}>
                  {task.invoice?.invoiceNumber ?? 'Invoice'}
                </Link>
                <span className="muted">
                  {' '}
                  · {task.invoice?.vendorNameRaw ?? '—'} ·{' '}
                  {money(task.invoice?.totalMinor ?? null, task.invoice?.currency ?? 'EUR')}
                </span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => void decide(task.id, 'approve')}>
                  Approve
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => void decide(task.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Usage</h2>
        {usage && (
          <dl className="kv">
            <div>
              <dt>Approved (billable)</dt>
              <dd>{usage.approvedInvoices}</dd>
            </div>
            <div>
              <dt>OCR pages ({usage.yearMonth})</dt>
              <dd>{usage.ocrPagesThisMonth}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="panel">
        <h2>Approval policy</h2>
        {policy && (
          <p className="muted">
            {policy.name}: auto-approve under{' '}
            {policy.autoApproveUnderMinor == null
              ? 'never'
              : money(policy.autoApproveUnderMinor, 'EUR')}
            {policy.enabled ? '' : ' (disabled)'}
          </p>
        )}
      </div>

      <div className="panel">
        <h2>API health</h2>
        {health && (
          <dl className="kv">
            <div>
              <dt>Status</dt>
              <dd>{health.status}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{health.database ?? 'unknown'}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
