import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type Invoice = {
  id: string;
  status: string;
  invoiceNumber: string | null;
  vendorNameRaw: string | null;
  vendorId: string | null;
  purchaseOrderId: string | null;
  currency: string;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  notes: string | null;
  ocrConfidence: number | null;
  fileAsset: { originalName: string; mimeType: string } | null;
  purchaseOrder: {
    id: string;
    number: string;
    title: string;
    status: string;
    totalMinor: number | null;
  } | null;
  lines: {
    id: string;
    lineNo: number;
    description: string | null;
    amountMinor: number | null;
  }[];
  exceptions: { id: string; code: string; message: string; resolved: boolean }[];
};

type Vendor = { id: string; code: string; name: string };
type PoOption = {
  id: string;
  number: string;
  title: string;
  status: string;
  totalMinor: number | null;
};

type ActivityItem =
  | {
      id: string;
      kind: 'audit';
      at: string;
      actorName: string | null;
      action: string;
    }
  | {
      id: string;
      kind: 'comment';
      at: string;
      actorName: string | null;
      body: string;
    };

type Comment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

function formatAction(action: string) {
  const labels: Record<string, string> = {
    'invoice.updated': 'Updated invoice fields',
    'invoice.uploaded': 'Uploaded document',
    'invoice.captured_email': 'Captured via email',
    'invoice.submitted': 'Submitted for approval',
    'invoice.approved': 'Approved',
    'invoice.rejected': 'Rejected',
    'invoice.voided': 'Voided',
    'invoice.exceptions_resolved': 'Resolved exceptions',
  };
  return labels[action] ?? action.replace(/\./g, ' ');
}

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
  const [purchaseOrders, setPurchaseOrders] = useState<PoOption[]>([]);
  const [poLicensed, setPoLicensed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    { code: string; message: string; blocking: boolean }[]
  >([]);
  const [duplicateOfId, setDuplicateOfId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');

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
  const [purchaseOrderId, setPurchaseOrderId] = useState('');

  async function loadSidePanels(invoiceId: string) {
    const [validation, activityRows, commentRows] = await Promise.all([
      apiFetch<{
        issues: { code: string; message: string; blocking: boolean }[];
        duplicateOfId: string | null;
        blocking: boolean;
        invoice: Invoice;
      }>(`/api/invoices/${invoiceId}/validation`),
      apiFetch<ActivityItem[]>(`/api/invoices/${invoiceId}/activity`),
      apiFetch<Comment[]>(`/api/invoices/${invoiceId}/comments`),
    ]);
    setValidationIssues(validation.issues);
    setDuplicateOfId(validation.duplicateOfId);
    setInvoice(validation.invoice);
    setActivity(activityRows);
    setComments(commentRows);
    return validation;
  }

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [validation, vendorList, modules] = await Promise.all([
          loadSidePanels(id),
          apiFetch<Vendor[]>('/api/vendors'),
          apiFetch<{ moduleKey: string; enabled: boolean }[]>(
            '/api/modules',
          ).catch(() => [] as { moduleKey: string; enabled: boolean }[]),
        ]);
        setVendors(vendorList);
        const ordersOn = modules.some(
          (m) => m.moduleKey === 'purchase_orders' && m.enabled,
        );
        setPoLicensed(ordersOn);
        if (ordersOn) {
          const pos = await apiFetch<PoOption[]>('/api/purchase-orders').catch(
            () => [] as PoOption[],
          );
          setPurchaseOrders(pos);
        }
        const current = validation.invoice;
        setInvoiceNumber(current.invoiceNumber ?? '');
        setVendorNameRaw(current.vendorNameRaw ?? '');
        setVendorId(current.vendorId ?? '');
        setCurrency(current.currency);
        setInvoiceDate(toDateInput(current.invoiceDate));
        setDueDate(toDateInput(current.dueDate));
        setSubtotal(toMajor(current.subtotalMinor));
        setTax(toMajor(current.taxMinor));
        setTotal(toMajor(current.totalMinor));
        setNotes(current.notes ?? '');
        setPurchaseOrderId(current.purchaseOrderId ?? '');
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
          purchaseOrderId: purchaseOrderId || null,
        }),
      });
      setInvoice(inv);
      const validation = await loadSidePanels(id);
      setMessage(
        validation.blocking
          ? 'Saved — blocking validation issues remain'
          : 'Saved — ready to submit',
      );
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
    await loadSidePanels(id);
    setMessage('Exceptions marked resolved');
  }

  async function onAddComment(e: FormEvent) {
    e.preventDefault();
    if (!id || !commentBody.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/invoices/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      setCommentBody('');
      await loadSidePanels(id);
      setMessage('Comment added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed');
    }
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
          {duplicateOfId && (
            <p className="error">
              Duplicate of{' '}
              <Link to={`/invoices/${duplicateOfId}`}>open original</Link>
            </p>
          )}
          <button type="button" className="secondary-btn" onClick={() => void onResolve()}>
            Mark exceptions resolved
          </button>
        </div>
      )}

      {validationIssues.length > 0 &&
        !invoice.exceptions.some((x) => !x.resolved) && (
          <div className="panel">
            <h2>Validation</h2>
            <ul>
              {validationIssues.map((x) => (
                <li key={`${x.code}-${x.message}`}>
                  <strong>{x.code}</strong> — {x.message}
                </li>
              ))}
            </ul>
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
        {poLicensed && (
          <label>
            Purchase order
            <select
              value={purchaseOrderId}
              onChange={(e) => setPurchaseOrderId(e.target.value)}
            >
              <option value="">— none —</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.number} — {po.title} ({po.status})
                </option>
              ))}
            </select>
          </label>
        )}
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

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Activity</h2>
        {activity.length === 0 && <p className="muted">No activity yet.</p>}
        <ul className="activity-feed">
          {activity.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <span className="activity-feed__time">
                {new Date(item.at).toLocaleString()}
              </span>
              <span className="activity-feed__actor">
                {item.actorName ?? 'System'}
              </span>
              {item.kind === 'comment' ? (
                <p className="activity-feed__body">{item.body}</p>
              ) : (
                <p className="activity-feed__body">{formatAction(item.action)}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Comments</h2>
        {comments.length === 0 && <p className="muted">No comments yet.</p>}
        <ul className="task-list">
          {comments.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.authorName}</strong>
                <span className="muted">
                  {' '}
                  · {new Date(c.createdAt).toLocaleString()}
                </span>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={(e) => void onAddComment(e)}>
          <input
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            required
            style={{ flex: 1, minWidth: '12rem' }}
          />
          <button type="submit">Post</button>
        </form>
      </div>
    </section>
  );
}
