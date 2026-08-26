import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type Invoice = {
  id: string;
  status: string;
  invoiceNumber: string | null;
  vendorNameRaw: string | null;
  vendorId: string | null;
  currency: string;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  notes: string | null;
  ocrConfidence: number | null;
  fileAsset: { originalName: string; mimeType: string } | null;
  lines: {
    id: string;
    lineNo: number;
    description: string | null;
    amountMinor: number | null;
  }[];
  exceptions: { id: string; code: string; message: string; resolved: boolean }[];
};

type Vendor = { id: string; code: string; name: string };

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function fromMajor(value: string): number | null {
  if (value.trim() === '') return null;
  return Math.round(parseFloat(value) * 100);
}

function toMajor(minor: number | null): string {
  if (minor == null) return '';
  return (minor / 100).toFixed(2);
}

export function InvoiceWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorNameRaw, setVendorNameRaw] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [inv, vendorList] = await Promise.all([
          apiFetch<Invoice>(`/api/invoices/${id}`),
          apiFetch<Vendor[]>('/api/vendors'),
        ]);
        setInvoice(inv);
        setVendors(vendorList);
        setInvoiceNumber(inv.invoiceNumber ?? '');
        setVendorNameRaw(inv.vendorNameRaw ?? '');
        setVendorId(inv.vendorId ?? '');
        setCurrency(inv.currency);
        setInvoiceDate(toDateInput(inv.invoiceDate));
        setDueDate(toDateInput(inv.dueDate));
        setSubtotal(toMajor(inv.subtotalMinor));
        setTax(toMajor(inv.taxMinor));
        setTotal(toMajor(inv.totalMinor));
        setNotes(inv.notes ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
  }, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setMessage(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          invoiceNumber: invoiceNumber || null,
          vendorNameRaw: vendorNameRaw || null,
          vendorId: vendorId || null,
          currency,
          invoiceDate: invoiceDate || null,
          dueDate: dueDate || null,
          subtotalMinor: fromMajor(subtotal),
          taxMinor: fromMajor(tax),
          totalMinor: fromMajor(total),
          notes: notes || null,
        }),
      });
      setInvoice(inv);
      setMessage('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function onApprove() {
    if (!id) return;
    setError(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}/approve`, {
        method: 'POST',
      });
      setInvoice(inv);
      setMessage('Force-approved — billable transaction recorded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  async function onSubmit() {
    if (!id) return;
    setError(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}/submit`, {
        method: 'POST',
      });
      setInvoice(inv);
      setMessage(
        inv.status === 'approved'
          ? 'Auto-approved by policy'
          : 'Submitted for approval',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  }

  async function onResolve() {
    if (!id) return;
    const inv = await apiFetch<Invoice>(`/api/invoices/${id}/resolve-exceptions`, {
      method: 'POST',
    });
    setInvoice(inv);
    setMessage('Exceptions marked resolved');
  }

  if (!invoice && !error) return <section className="page"><p>Loading…</p></section>;
  if (!invoice) {
    return (
      <section className="page">
        <p className="error">{error}</p>
        <Link to="/invoices">Back</Link>
      </section>
    );
  }

  return (
    <section className="page">
      <p className="eyebrow">Invoice workspace</p>
      <h1>{invoice.invoiceNumber ?? 'Draft invoice'}</h1>
      <p className="lede">
        Status: <strong>{invoice.status}</strong>
        {invoice.ocrConfidence != null && (
          <> · OCR confidence {(invoice.ocrConfidence * 100).toFixed(0)}%</>
        )}
        {invoice.fileAsset && <> · {invoice.fileAsset.originalName}</>}
      </p>

      {invoice.exceptions.some((x) => !x.resolved) && (
        <div className="panel">
          <h2>Exceptions</h2>
          <ul>
            {invoice.exceptions
              .filter((x) => !x.resolved)
              .map((x) => (
                <li key={x.id}>
                  <strong>{x.code}</strong> — {x.message}
                </li>
              ))}
          </ul>
          <button type="button" className="secondary-btn" onClick={() => void onResolve()}>
            Mark exceptions resolved
          </button>
        </div>
      )}

      <form className="workspace-form" onSubmit={onSave}>
        <label>
          Invoice number
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </label>
        <label>
          Vendor (raw)
          <input value={vendorNameRaw} onChange={(e) => setVendorNameRaw(e.target.value)} />
        </label>
        <label>
          Vendor master
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">— none —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
        </label>
        <label>
          Invoice date
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label>
          Subtotal
          <input value={subtotal} onChange={(e) => setSubtotal(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Tax
          <input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Total
          <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="span-2">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        {error && <p className="error span-2">{error}</p>}
        {message && <p className="ok span-2">{message}</p>}

        <div className="span-2 actions">
          <button type="submit">Save</button>
          <button type="button" onClick={() => void onSubmit()}>
            Submit for approval
          </button>
          <button type="button" onClick={() => void onApprove()} disabled={invoice.status === 'approved' || invoice.status === 'exported'}>
            Force approve
          </button>
          <button type="button" className="secondary-btn" onClick={() => navigate('/invoices')}>
            Back to list
          </button>
        </div>
      </form>

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Lines</h2>
        <ul>
          {invoice.lines.map((line) => (
            <li key={line.id}>
              #{line.lineNo} {line.description ?? '—'}{' '}
              {line.amountMinor != null ? `(${(line.amountMinor / 100).toFixed(2)})` : ''}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
