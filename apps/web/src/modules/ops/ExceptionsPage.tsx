import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type ExceptionItem = {
  id: string;
  code: string;
  message: string;
  createdAt: string;
  ageHours: number;
  invoice: {
    id: string;
    status: string;
    invoiceNumber: string | null;
    vendorNameRaw: string | null;
    currency: string;
    totalMinor: number | null;
  };
};

type ExceptionQueue = {
  total: number;
  byCode: { code: string; count: number }[];
  items: ExceptionItem[];
};

function money(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

function ageLabel(hours: number) {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function ExceptionsPage() {
  const [data, setData] = useState<ExceptionQueue | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const q = code ? `?code=${encodeURIComponent(code)}` : '';
    setData(await apiFetch<ExceptionQueue>(`/api/invoices/exceptions${q}`));
  }, [code]);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, [refresh]);

  async function resolveInvoice(invoiceId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/invoices/${invoiceId}/resolve-exceptions`, {
        method: 'POST',
      });
      setMessage('Exceptions marked resolved');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">AP clearing</p>
      <h1>Exceptions</h1>
      <p className="lede">
        Open exceptions grouped by code, oldest first for aging focus.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="view-chips">
        <button
          type="button"
          className={!code ? 'view-chip view-chip--active' : 'view-chip'}
          onClick={() => setCode('')}
        >
          All ({data?.total ?? 0})
        </button>
        {(data?.byCode ?? []).map((row) => (
          <button
            key={row.code}
            type="button"
            className={
              code === row.code ? 'view-chip view-chip--active' : 'view-chip'
            }
            onClick={() => setCode(row.code)}
          >
            {row.code} ({row.count})
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Invoice</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Age</th>
              <th>Message</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="status-chip">{item.code}</span>
                </td>
                <td>
                  <Link to={`/invoices/${item.invoice.id}`}>
                    {item.invoice.invoiceNumber ?? 'Draft'}
                  </Link>
                </td>
                <td>{item.invoice.vendorNameRaw ?? '—'}</td>
                <td>
                  {money(item.invoice.totalMinor, item.invoice.currency)}
                </td>
                <td className={item.ageHours >= 72 ? 'error' : 'muted'}>
                  {ageLabel(item.ageHours)}
                </td>
                <td>{item.message}</td>
                <td>
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => void resolveInvoice(item.invoice.id)}
                  >
                    Resolve
                  </button>
                </td>
              </tr>
            ))}
            {(data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7}>No open exceptions — nice.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
