import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type InvoiceListItem = {
  id: string;
  status: string;
  invoiceNumber: string | null;
  vendorNameRaw: string | null;
  currency: string;
  totalMinor: number | null;
  createdAt: string;
  exceptions: { code: string }[];
  fileAsset: { originalName: string } | null;
};

function formatMoney(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export function InvoicesPage() {
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    setItems(await apiFetch<InvoiceListItem[]>(`/api/invoices${q}`));
  }, [status]);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, [refresh]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const token = sessionStorage.getItem('aptora_token');
      const res = await fetch('/api/capture/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? `Upload failed (${res.status})`);
      }
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <h1>Invoices</h1>
      <p className="lede">Capture documents, review stub OCR, approve payment-ready invoices.</p>

      <form className="inline-form" onSubmit={onUpload}>
        <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" required />
        <button type="submit" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload & extract'}
        </button>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="needs_review">Needs review</option>
          <option value="approved">Approved</option>
          <option value="exception">Exception</option>
          <option value="void">Void</option>
        </select>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Status</th>
              <th>Exceptions</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link to={`/invoices/${inv.id}`}>{inv.invoiceNumber ?? 'Draft'}</Link>
                </td>
                <td>{inv.vendorNameRaw ?? '—'}</td>
                <td>{formatMoney(inv.totalMinor, inv.currency)}</td>
                <td>
                  <span className="status-chip">{inv.status}</span>
                </td>
                <td>{inv.exceptions.map((x) => x.code).join(', ') || '—'}</td>
                <td>{inv.fileAsset?.originalName ?? '—'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6}>No invoices yet — upload a PDF or a simple .txt stub.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
