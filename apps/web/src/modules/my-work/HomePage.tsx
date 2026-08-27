import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import { formatMoney } from '../procure/shared';

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

type CommandCenter = {
  invoices: {
    needsReview: number;
    exceptions: number;
    inApproval: number;
    exportBacklog: number;
  };
  contracts: {
    draft: number;
    inApproval: number;
    pendingSignature: number;
    active: number;
  };
  purchaseRequests: {
    draft: number;
    inApproval: number;
    approved: number;
  };
  purchaseOrders: {
    draft: number;
    issued: number;
    remainingMinorSum: number;
  };
  accruals: {
    draft: number;
    inApproval: number;
    approved: number;
  };
  myApprovals: {
    invoiceTasks: number;
    contractsInApproval: number;
    prsInApproval: number;
    accrualsInApproval: number;
  };
};

function ageLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

export function HomePage() {
  const [cc, setCc] = useState<CommandCenter | null>(null);
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [center, t] = await Promise.all([
      apiFetch<CommandCenter>('/api/ops/command-center'),
      apiFetch<ApprovalTask[]>('/api/approvals/my-work'),
    ]);
    setCc(center);
    setTasks(t);
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

  const attentionCount =
    (cc?.myApprovals.invoiceTasks ?? tasks.length) +
    (cc?.myApprovals.contractsInApproval ?? 0) +
    (cc?.myApprovals.prsInApproval ?? 0) +
    (cc?.myApprovals.accrualsInApproval ?? 0);

  return (
    <section className="page page--cockpit">
      <header className="cockpit-hero">
        <div>
          <p className="eyebrow">Cross-module</p>
          <h1>Command Center</h1>
          <p className="lede">
            What needs your attention across AP and Procure — clear the queue,
            keep work moving.
          </p>
        </div>
        <div className="cockpit-hero__actions">
          <Link className="btn btn--primary" to="/invoices">
            Open invoices
          </Link>
          <Link className="btn btn--ghost" to="/account/delegation">
            My delegation
          </Link>
          <Link className="btn btn--ghost" to="/ops">
            Operations
          </Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="stat-grid">
        <Link className="stat-tile" to="/contracts">
          <span className="stat-tile__label">Contracts</span>
          <span className="stat-tile__value">
            {cc ? cc.contracts.inApproval + cc.contracts.draft : '—'}
          </span>
        </Link>
        <Link className="stat-tile" to="/purchase-requests">
          <span className="stat-tile__label">Requests</span>
          <span className="stat-tile__value">
            {cc
              ? cc.purchaseRequests.inApproval + cc.purchaseRequests.draft
              : '—'}
          </span>
        </Link>
        <Link className="stat-tile" to="/purchase-orders">
          <span className="stat-tile__label">Orders</span>
          <span className="stat-tile__value">
            {cc ? cc.purchaseOrders.issued + cc.purchaseOrders.draft : '—'}
          </span>
        </Link>
        <Link
          className="stat-tile"
          to="/invoices?view=review&status=needs_review"
        >
          <span className="stat-tile__label">Invoices</span>
          <span className="stat-tile__value">
            {cc ? cc.invoices.needsReview + cc.invoices.inApproval : '—'}
          </span>
        </Link>
        <Link className="stat-tile" to="/exceptions">
          <span className="stat-tile__label">Exceptions</span>
          <span className="stat-tile__value">{cc?.invoices.exceptions ?? '—'}</span>
        </Link>
        <Link className="stat-tile" to="/purchase-orders">
          <span className="stat-tile__label">Accruals</span>
          <span className="stat-tile__value">
            {cc ? cc.accruals.draft + cc.accruals.inApproval : '—'}
          </span>
        </Link>
      </div>

      <div className="panel panel--wide panel--lift">
        <div className="panel__head">
          <div>
            <h2>Needs your attention</h2>
            <p className="muted">
              {attentionCount === 0
                ? 'Nothing waiting on you right now.'
                : `${attentionCount} item${attentionCount === 1 ? '' : 's'} across modules.`}
            </p>
          </div>
        </div>

        {cc && (
          <div className="procure__kpis" style={{ marginBottom: '1rem' }}>
            <Link className="procure__kpi" to="/contracts">
              <div className="procure__kpi-label">Contracts in approval</div>
              <div className="procure__kpi-value">
                {cc.myApprovals.contractsInApproval}
              </div>
            </Link>
            <Link className="procure__kpi" to="/purchase-requests">
              <div className="procure__kpi-label">Requests in approval</div>
              <div className="procure__kpi-value">
                {cc.myApprovals.prsInApproval}
              </div>
            </Link>
            <Link className="procure__kpi" to="/purchase-orders">
              <div className="procure__kpi-label">Accruals in approval</div>
              <div className="procure__kpi-value">
                {cc.myApprovals.accrualsInApproval}
              </div>
            </Link>
            <div className="procure__kpi">
              <div className="procure__kpi-label">Invoice tasks</div>
              <div className="procure__kpi-value">{tasks.length}</div>
            </div>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__orb" aria-hidden />
            <h3>Invoice queue clear</h3>
            <p className="muted">
              No invoice approvals assigned to you. Check contracts and requests
              above if counts are open.
            </p>
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
                  {formatMoney(
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

      {cc && (
        <div className="stat-grid stat-grid--panels" style={{ marginTop: '1.25rem' }}>
          <div className="panel">
            <h3>Invoices</h3>
            <dl className="kv">
              <dt>Needs review</dt>
              <dd>
                <Link to="/invoices?view=review&status=needs_review">
                  {cc.invoices.needsReview}
                </Link>
              </dd>
              <dt>In approval</dt>
              <dd>
                <Link to="/invoices?view=approval&status=in_approval">
                  {cc.invoices.inApproval}
                </Link>
              </dd>
              <dt>Exceptions</dt>
              <dd>
                <Link to="/exceptions">{cc.invoices.exceptions}</Link>
              </dd>
              <dt>Export backlog</dt>
              <dd>{cc.invoices.exportBacklog}</dd>
            </dl>
          </div>
          <div className="panel">
            <h3>Contracts</h3>
            <dl className="kv">
              <dt>Draft</dt>
              <dd>
                <Link to="/contracts">{cc.contracts.draft}</Link>
              </dd>
              <dt>In approval</dt>
              <dd>
                <Link to="/contracts">{cc.contracts.inApproval}</Link>
              </dd>
              <dt>Pending signature</dt>
              <dd>{cc.contracts.pendingSignature}</dd>
              <dt>Active</dt>
              <dd>{cc.contracts.active}</dd>
            </dl>
          </div>
          <div className="panel">
            <h3>Requests &amp; orders</h3>
            <dl className="kv">
              <dt>PR in approval</dt>
              <dd>
                <Link to="/purchase-requests">
                  {cc.purchaseRequests.inApproval}
                </Link>
              </dd>
              <dt>PR approved</dt>
              <dd>{cc.purchaseRequests.approved}</dd>
              <dt>PO issued</dt>
              <dd>
                <Link to="/purchase-orders">{cc.purchaseOrders.issued}</Link>
              </dd>
              <dt>Unbilled (open POs)</dt>
              <dd>{formatMoney(cc.purchaseOrders.remainingMinorSum)}</dd>
            </dl>
          </div>
          <div className="panel">
            <h3>Accruals</h3>
            <dl className="kv">
              <dt>Draft</dt>
              <dd>
                <Link to="/purchase-orders">{cc.accruals.draft}</Link>
              </dd>
              <dt>In approval</dt>
              <dd>
                <Link to="/purchase-orders">{cc.accruals.inApproval}</Link>
              </dd>
              <dt>Approved</dt>
              <dd>{cc.accruals.approved}</dd>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
