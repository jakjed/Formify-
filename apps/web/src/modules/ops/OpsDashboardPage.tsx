import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

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

export function OpsDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Dashboard>('/api/ops/dashboard')
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <p className="eyebrow">Operations</p>
      <h1>Dashboard</h1>
      <p className="lede">
        Status mix, exception aging, export backlog, and billable usage.
      </p>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="stat-grid">
            <Link className="stat-tile" to="/invoices?view=review&status=needs_review">
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
    </section>
  );
}
