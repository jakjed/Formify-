import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type PoLine = {
  id: string;
  lineNo: number;
  description: string | null;
  quantity: number | null;
  receivedQty: number | null;
};

type Po = {
  id: string;
  number: string;
  title: string;
  status: string;
  totalMinor: number | null;
  purchaseRequest: {
    id: string;
    number: string;
    title: string;
    status: string;
  } | null;
  lines: PoLine[];
};

export function PurchaseOrdersPage() {
  const [rows, setRows] = useState<Po[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [partialQty, setPartialQty] = useState<Record<string, string>>({});

  async function refresh() {
    setRows(await apiFetch<Po[]>('/api/purchase-orders'));
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const qty = Number(data.get('qty') || 1) || 1;
      const unit = Number(data.get('unitPriceMinor') || 0) || undefined;
      await apiFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          totalMinor: Number(data.get('totalMinor') || 0) || undefined,
          lines: [
            {
              description: String(data.get('lineDesc') || 'Line 1'),
              quantity: qty,
              unitPriceMinor: unit,
              amountMinor: unit ? unit * qty : undefined,
            },
          ],
        }),
      });
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function transition(id: string, status: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/purchase-orders/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setBusy(false);
    }
  }

  async function receiveAll(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Po>(`/api/purchase-orders/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage(`${row.number} → ${row.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed');
    } finally {
      setBusy(false);
    }
  }

  async function receivePartial(po: Po) {
    const line = po.lines[0];
    if (!line) return;
    const raw = partialQty[po.id] ?? '1';
    const quantity = Number(raw);
    if (!(quantity > 0)) {
      setError('Enter a positive receive quantity');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Po>(`/api/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          lines: [{ lineNo: line.lineNo, quantity }],
        }),
      });
      setMessage(`${row.number} → ${row.status}`);
      setPartialQty((m) => ({ ...m, [po.id]: '' }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Purchase orders</h1>
      <p className="lede">
        Issue, receive (partial or full), then close — convert from{' '}
        <Link to="/purchase-requests">approved requests</Link>.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}
      <ul className="task-list">
        {rows.map((row) => {
          const line = row.lines?.[0];
          const remaining =
            line && line.quantity != null
              ? Math.max(0, line.quantity - (line.receivedQty ?? 0))
              : null;
          return (
            <li key={row.id}>
              <div>
                <strong>
                  {row.number} · {row.title}
                </strong>
                <span className="muted"> · {row.status}</span>
                {row.purchaseRequest && (
                  <span className="muted">
                    {' '}
                    · from{' '}
                    <Link to="/purchase-requests">
                      {row.purchaseRequest.number}
                    </Link>
                  </span>
                )}
                {line && (
                  <span className="muted">
                    {' '}
                    · recv {line.receivedQty ?? 0}/{line.quantity ?? '—'}
                    {line.description ? ` (${line.description})` : ''}
                  </span>
                )}
              </div>
              <div className="actions">
                {row.status === 'draft' && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => void transition(row.id, 'issued')}
                  >
                    Issue
                  </button>
                )}
                {(row.status === 'issued' ||
                  row.status === 'partially_received') && (
                  <>
                    <input
                      type="number"
                      min={0.0001}
                      step="any"
                      placeholder={
                        remaining != null ? `qty (≤${remaining})` : 'qty'
                      }
                      value={partialQty[row.id] ?? ''}
                      onChange={(e) =>
                        setPartialQty((m) => ({
                          ...m,
                          [row.id]: e.target.value,
                        }))
                      }
                      style={{ width: '7rem' }}
                    />
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => void receivePartial(row)}
                    >
                      Receive
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void receiveAll(row.id)}
                    >
                      Receive all
                    </button>
                  </>
                )}
                {row.status === 'received' && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => void transition(row.id, 'closed')}
                  >
                    Close
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="muted">No purchase orders yet.</li>}
      </ul>
      <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
        <label>
          Number
          <input name="number" required placeholder="PO-1001" />
        </label>
        <label>
          Title
          <input name="title" required minLength={2} />
        </label>
        <label>
          Line description
          <input name="lineDesc" placeholder="Goods" />
        </label>
        <label>
          Qty
          <input name="qty" type="number" min={1} defaultValue={2} />
        </label>
        <label>
          Unit price (minor)
          <input name="unitPriceMinor" type="number" min={0} />
        </label>
        <label>
          Total (minor)
          <input name="totalMinor" type="number" min={0} />
        </label>
        <div className="span-2 actions">
          <button type="submit" disabled={busy}>
            Create draft
          </button>
        </div>
      </form>
    </section>
  );
}
