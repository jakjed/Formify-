import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import { formatMoney } from '../procure/shared';

type Dashboard = {
  byStatus: Record<string, number>;
  openWork: {
    needsReview: number;
    inApproval: number;
    exception: number;
    totalOpen: number;
  };
  exceptions: {
    openCount: number;
    aging: { under24h: number; d1to3: number; over3d: number };
    byCode: { code: string; count: number }[];
  };
  exportBacklog: number;
  usage: {
    approvedInvoicesMtd: number;
    approvedInvoices: number;
    ocrPagesThisMonth: number;
    yearMonth: string;
    planName: string;
    softWarned: boolean;
    hardBlocked: boolean;
  };
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
};

export function OpsDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [cc, setCc] = useState<CommandCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<Dashboard>('/api/ops/dashboard'),
      apiFetch<CommandCenter>('/api/ops/command-center'),
    ])
      .then(([dash, center]) => {
        setData(dash);
        setCc(center);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <p className="eyebrow">Command view</p>
      <h1>Operations</h1>
      <p className="lede">
        Cross-module view across AP and Procure — status mix, exception aging,
        and procure KPIs.
      </p>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <h2>Accounts payable</h2>
          <div className="stat-grid">
            <Link
              className="stat-tile"
              to="/invoices?view=review&status=needs_review"
            >
              <span className="stat-tile__label">Needs review</span>
              <span className="stat-tile__value">{data.openWork.needsReview}</span>
            </Link>
            <Link className="stat-tile" to="/exceptions">
              <span className="stat-tile__label">Open exceptions</span>
              <span className="stat-tile__value">{data.exceptions.openCount}</span>
            </Link>
            <Link
              className="stat-tile"
              to="/invoices?view=approval&status=in_approval"
            >
              <span className="stat-tile__label">In approval</span>
              <span className="stat-tile__value">{data.openWork.inApproval}</span>
            </Link>
            <Link
              className="stat-tile"
              to="/invoices?view=approved&status=approved"
            >
              <span className="stat-tile__label">Export backlog</span>
              <span className="stat-tile__value">{data.exportBacklog}</span>
            </Link>
            <div className="stat-tile">
              <span className="stat-tile__label">Approved MTD</span>
              <span className="stat-tile__value">
                {data.usage.approvedInvoicesMtd}
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">
                OCR pages ({data.usage.yearMonth})
              </span>
              <span className="stat-tile__value">
                {data.usage.ocrPagesThisMonth}
              </span>
            </div>
          </div>

          {(data.usage.softWarned || data.usage.hardBlocked) && (
            <p className="error">
              {data.usage.hardBlocked
                ? 'Hard approve limit reached — approvals blocked.'
                : 'Soft approve limit reached — consider upgrading.'}
            </p>
          )}

          <div className="panel">
            <h2>Exception aging</h2>
            <dl className="kv">
              <dt>&lt; 24h</dt>
              <dd>{data.exceptions.aging.under24h}</dd>
              <dt>1–3 days</dt>
              <dd>{data.exceptions.aging.d1to3}</dd>
              <dt>&gt; 3 days</dt>
              <dd>{data.exceptions.aging.over3d}</dd>
            </dl>
            {data.exceptions.byCode.length > 0 && (
              <ul className="task-list">
                {data.exceptions.byCode.map((row) => (
                  <li key={row.code}>
                    <Link to={`/exceptions`}>{row.code}</Link>
                    <span className="muted"> · {row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h2>By status</h2>
            <ul className="task-list">
              {Object.entries(data.byStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <li key={status}>
                    <span className="status-chip">{status}</span>
                    <span className="muted"> · {count}</span>
                  </li>
                ))}
              {Object.keys(data.byStatus).length === 0 && (
                <li className="muted">No invoices yet.</li>
              )}
            </ul>
          </div>
        </>
      )}

      {cc && (
        <>
          <h2 style={{ marginTop: '1.75rem' }}>Procure</h2>
          <div className="stat-grid">
            <Link className="stat-tile" to="/contracts">
              <span className="stat-tile__label">Contracts in approval</span>
              <span className="stat-tile__value">{cc.contracts.inApproval}</span>
            </Link>
            <Link className="stat-tile" to="/contracts">
              <span className="stat-tile__label">Pending signature</span>
              <span className="stat-tile__value">
                {cc.contracts.pendingSignature}
              </span>
            </Link>
            <Link className="stat-tile" to="/purchase-requests">
              <span className="stat-tile__label">PR in approval</span>
              <span className="stat-tile__value">
                {cc.purchaseRequests.inApproval}
              </span>
            </Link>
            <Link className="stat-tile" to="/purchase-requests">
              <span className="stat-tile__label">PR approved</span>
              <span className="stat-tile__value">
                {cc.purchaseRequests.approved}
              </span>
            </Link>
            <Link className="stat-tile" to="/purchase-orders">
              <span className="stat-tile__label">PO issued</span>
              <span className="stat-tile__value">{cc.purchaseOrders.issued}</span>
            </Link>
            <Link className="stat-tile" to="/purchase-orders">
              <span className="stat-tile__label">Unbilled open POs</span>
              <span className="stat-tile__value">
                {formatMoney(cc.purchaseOrders.remainingMinorSum)}
              </span>
            </Link>
            <Link className="stat-tile" to="/purchase-orders">
              <span className="stat-tile__label">Accruals in approval</span>
              <span className="stat-tile__value">{cc.accruals.inApproval}</span>
            </Link>
            <Link className="stat-tile" to="/purchase-orders">
              <span className="stat-tile__label">Accrual drafts</span>
              <span className="stat-tile__value">{cc.accruals.draft}</span>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
