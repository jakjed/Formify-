import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

const ACCRUAL_CHAIN = ['AP Manager', 'Controller'] as const;

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
  currency?: string;
  invoicedMinor?: number;
  remainingMinor?: number;
  purchaseRequest: {
    id: string;
    number: string;
    title: string;
    status: string;
  } | null;
  lines: PoLine[];
};

type Accrual = {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  approvalStage: number;
  vendorName: string | null;
  department: string | null;
  category: string | null;
  purchaseOrder: {
    id: string;
    number: string;
    title: string;
    status: string;
  } | null;
  contract: { id: string; number: string; title: string } | null;
};

type Tab = 'orders' | 'accruals';

function formatMoney(minor: number | null | undefined, currency = 'EUR') {
  if (minor == null) return '—';
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function PurchaseOrdersPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [rows, setRows] = useState<Po[]>([]);
  const [accruals, setAccruals] = useState<Accrual[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [partialQty, setPartialQty] = useState<Record<string, string>>({});

  async function refreshOrders() {
    setRows(await apiFetch<Po[]>('/api/purchase-orders'));
  }

  async function refreshAccruals() {
    setAccruals(await apiFetch<Accrual[]>('/api/accruals'));
  }

  async function refresh() {
    await Promise.all([
      refreshOrders(),
      refreshAccruals().catch(() => setAccruals([])),
    ]);
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
      await refreshOrders();
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
      await refreshOrders();
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
      await refreshOrders();
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
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed');
    } finally {
      setBusy(false);
    }
  }

  async function generateAccruals() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<Accrual[]>(
        '/api/accruals/generate-from-open-pos',
        { method: 'POST', body: JSON.stringify({}) },
      );
      setMessage(
        created.length
          ? `Generated/refreshed ${created.length} accrual(s).`
          : 'No open POs with remaining amount.',
      );
      await refreshAccruals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  async function accrualAction(
    id: string,
    path: 'send-for-approval' | 'advance-approval' | 'post-to-erp',
    okMsg: string,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/accruals/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage(okMsg);
      await refreshAccruals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Purchase orders</h1>
      <p className="lede">
        Issue, receive, and accrue remaining spend — convert from{' '}
        <Link to="/purchase-requests">approved requests</Link>.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="tabs">
        {(
          [
            ['orders', 'Orders'],
            ['accruals', 'Accruals'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tabs__btn tabs__btn--active' : 'tabs__btn'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          <ul className="task-list">
            {rows.map((row) => {
              const line = row.lines?.[0];
              const remainingQty =
                line && line.quantity != null
                  ? Math.max(0, line.quantity - (line.receivedQty ?? 0))
                  : null;
              const currency = row.currency ?? 'EUR';
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
                    <span className="muted">
                      {' '}
                      · total {formatMoney(row.totalMinor, currency)}
                      {' · invoiced '}
                      {formatMoney(row.invoicedMinor ?? 0, currency)}
                      {' · remaining '}
                      {formatMoney(
                        row.remainingMinor ?? row.totalMinor ?? 0,
                        currency,
                      )}
                    </span>
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
                            remainingQty != null
                              ? `qty (≤${remainingQty})`
                              : 'qty'
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
            {rows.length === 0 && (
              <li className="muted">No purchase orders yet.</li>
            )}
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
        </>
      )}

      {tab === 'accruals' && (
        <div className="panel">
          <div className="actions" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void generateAccruals()}
            >
              Generate from open POs
            </button>
          </div>
          <p className="muted">
            Draft accruals from uninvoiced PO remaining amounts. Approval chain:{' '}
            {ACCRUAL_CHAIN.join(' → ')}. Amount is display-only.
          </p>
          <ul className="task-list">
            {accruals.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>
                    {a.purchaseOrder?.number ?? 'PO'} ·{' '}
                    {formatMoney(a.amountMinor, a.currency)}
                  </strong>
                  <span className="muted">
                    {' '}
                    · {a.status}
                    {a.vendorName ? ` · ${a.vendorName}` : ''}
                    {a.department ? ` · ${a.department}` : ''}
                    {a.category ? ` · ${a.category}` : ''}
                    {a.contract ? ` · ${a.contract.number}` : ''}
                  </span>
                  {a.status === 'in_approval' && (
                    <p className="muted">
                      Stage {a.approvalStage}/{ACCRUAL_CHAIN.length}:{' '}
                      {ACCRUAL_CHAIN.map((label, i) => {
                        const stage = i + 1;
                        const marker =
                          stage < a.approvalStage
                            ? '✓'
                            : stage === a.approvalStage
                              ? '●'
                              : '○';
                        return (
                          <span key={label}>
                            {i > 0 ? ' → ' : ''}
                            {marker} {label}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
                <div className="actions">
                  {a.status === 'draft' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void accrualAction(
                          a.id,
                          'send-for-approval',
                          'Accrual sent for approval.',
                        )
                      }
                    >
                      Send for Approval
                    </button>
                  )}
                  {a.status === 'in_approval' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void accrualAction(
                          a.id,
                          'advance-approval',
                          'Accrual approval advanced.',
                        )
                      }
                    >
                      Advance
                    </button>
                  )}
                  {a.status === 'approved' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void accrualAction(
                          a.id,
                          'post-to-erp',
                          'Accrual posted to ERP (mock).',
                        )
                      }
                    >
                      Post to ERP
                    </button>
                  )}
                </div>
              </li>
            ))}
            {accruals.length === 0 && (
              <li className="muted">
                No accrual proposals yet — generate them from open POs.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
