import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import { appendEntityParam, formatEntityCell } from '../../shared/lib/entity';
import {
  ACCRUAL_APPROVAL_CHAIN,
  AccrualStatusBadge,
  PoStatusBadge,
  ProcureKpis,
  ApprovalProgress,
  ProcureTabs,
  formatMoney,
} from '../procure/shared';

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
  currency: string;
  totalMinor: number | null;
  entityId?: string | null;
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
  purchaseOrderId: string;
  vendorName: string | null;
  department: string | null;
  category: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  approvalStage: number;
  purchaseOrder?: { id: string; number: string; title: string; status: string };
};

type Tab = 'orders' | 'accruals';

export function PurchaseOrdersPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [rows, setRows] = useState<Po[]>([]);
  const [accruals, setAccruals] = useState<Accrual[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    appendEntityParam(params);
    const [pos, acc] = await Promise.all([
      apiFetch<Po[]>(`/api/purchase-orders?${params}`),
      apiFetch<Accrual[]>('/api/accruals').catch(() => [] as Accrual[]),
    ]);
    setRows(pos);
    setAccruals(acc);
  }, []);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, [refresh]);

  useEffect(() => {
    const onEntityChange = () => {
      void refresh().catch((err: Error) => setError(err.message));
    };
    window.addEventListener('aptora:entity-change', onEntityChange);
    return () => window.removeEventListener('aptora:entity-change', onEntityChange);
  }, [refresh]);

  const kpis = useMemo(() => {
    const open = rows.filter((r) =>
      ['issued', 'partially_received'].includes(r.status),
    );
    const remaining = open.reduce((s, r) => s + (r.remainingMinor ?? 0), 0);
    return [
      { label: 'Open POs', value: open.length },
      { label: 'Unbilled', value: formatMoney(remaining) },
      {
        label: 'Accrual drafts',
        value: accruals.filter((a) => a.status === 'draft').length,
      },
      {
        label: 'Posted accruals',
        value: accruals.filter((a) => a.status === 'posted').length,
      },
    ];
  }, [rows, accruals]);

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage(ok);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const qty = Number(data.get('qty') || 1) || 1;
    const unit = Number(data.get('unitPriceMinor') || 0) || undefined;
    await run(async () => {
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
      setShowNew(false);
    }, 'PO created');
  }

  async function onUpdate(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const totalRaw = String(data.get('totalMinor') ?? '').trim();
    await run(async () => {
      await apiFetch(`/api/purchase-orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.get('title'),
          ...(totalRaw === ''
            ? {}
            : { totalMinor: Number(totalRaw) || 0 }),
        }),
      });
      setEditingId(null);
    }, 'Purchase order updated');
  }

  return (
    <section className="page procure">
      <div className="procure__header">
        <div className="procure__header-copy">
          <p className="eyebrow">Procure</p>
          <h1>Purchase orders</h1>
          <p className="lede">
            Track commitments, receipts, and unbilled balances — then propose AP
            accruals from what is still open.
          </p>
        </div>
      </div>

      <ProcureKpis items={kpis} />
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <ProcureTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'orders', label: 'Orders', count: rows.length },
          { id: 'accruals', label: 'AP accruals', count: accruals.length },
        ]}
      />

      {tab === 'orders' && (
        <>
          <div className="procure__toolbar">
            <p className="procure__muted" style={{ margin: 0 }}>
              Purchase orders are usually created when a request completes approval.
              Remaining = PO value − invoiced.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowNew((v) => !v)}
            >
              + New PO
            </button>
          </div>

          {showNew && (
            <div className="procure__composer">
              <h3>New purchase order</h3>
              <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
                <label>
                  Number
                  <input name="number" required placeholder="PO-7010" />
                </label>
                <label>
                  Title
                  <input name="title" required placeholder="Facilities retainer" />
                </label>
                <label>
                  Total (minor)
                  <input name="totalMinor" type="number" placeholder="3150000" />
                </label>
                <label>
                  Qty
                  <input name="qty" type="number" defaultValue={1} />
                </label>
                <label className="span-2">
                  Line
                  <input name="lineDesc" placeholder="Monthly services" />
                </label>
                <input type="hidden" name="unitPriceMinor" value="" />
                <div className="span-2 actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setShowNew(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    Create draft
                  </button>
                </div>
              </form>
            </div>
          )}

          {editingId && (() => {
            const po = rows.find((r) => r.id === editingId);
            if (!po) return null;
            return (
              <div className="procure__composer">
                <h3>Edit {po.number}</h3>
                <form
                  className="workspace-form"
                  onSubmit={(e) => void onUpdate(e, po.id)}
                >
                  <label>
                    Title
                    <input name="title" required defaultValue={po.title} />
                  </label>
                  <label>
                    Total (minor)
                    <input
                      name="totalMinor"
                      type="number"
                      defaultValue={po.totalMinor ?? ''}
                    />
                  </label>
                  <div className="span-2 actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={busy}
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}

          <div className="procure__table-card">
            <div className="procure__table-wrap">
              <table className="procure__table">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Entity</th>
                    <th>Vendor / title</th>
                    <th>PO value</th>
                    <th>Invoiced</th>
                    <th>Remaining</th>
                    <th>Receipt</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((po) => {
                    const line = po.lines[0];
                    const received = line?.receivedQty ?? 0;
                    const qty = line?.quantity ?? 0;
                    return (
                      <tr key={po.id}>
                        <td className="procure__mono">{po.number}</td>
                        <td className="procure__mono">
                          {formatEntityCell(po.entityId)}
                        </td>
                        <td>
                          <div>{po.title}</div>
                          {po.purchaseRequest && (
                            <div className="procure__muted">
                              from{' '}
                              <Link to="/purchase-requests">
                                {po.purchaseRequest.number}
                              </Link>
                            </div>
                          )}
                        </td>
                        <td className="procure__mono">
                          {formatMoney(po.totalMinor, po.currency)}
                        </td>
                        <td className="procure__mono">
                          {formatMoney(po.invoicedMinor ?? 0, po.currency)}
                        </td>
                        <td className="procure__mono">
                          {formatMoney(po.remainingMinor ?? 0, po.currency)}
                        </td>
                        <td className="procure__mono">
                          {qty ? `${received}/${qty}` : '—'}
                        </td>
                        <td>
                          <PoStatusBadge status={po.status} />
                        </td>
                        <td>
                          <div className="procure__actions">
                            {po.status === 'draft' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    setShowNew(false);
                                    setEditingId(po.id);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--primary"
                                  disabled={busy}
                                  onClick={() =>
                                    void run(async () => {
                                      await apiFetch(
                                        `/api/purchase-orders/${po.id}/transition`,
                                        {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            status: 'issued',
                                          }),
                                        },
                                      );
                                    }, 'Issued')
                                  }
                                >
                                  Issue
                                </button>
                              </>
                            )}
                            {['issued', 'partially_received'].includes(po.status) && (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await apiFetch(
                                      `/api/purchase-orders/${po.id}/receive`,
                                      { method: 'POST', body: '{}' },
                                    );
                                  }, 'Received')
                                }
                              >
                                Receive all
                              </button>
                            )}
                            {po.status === 'received' && (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await apiFetch(
                                      `/api/purchase-orders/${po.id}/transition`,
                                      {
                                        method: 'POST',
                                        body: JSON.stringify({ status: 'closed' }),
                                      },
                                    );
                                  }, 'Closed')
                                }
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="procure__empty">No purchase orders yet</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'accruals' && (
        <>
          <div className="procure__toolbar">
            <p className="procure__muted" style={{ margin: 0 }}>
              Accruals are proposed from unbilled amounts on open POs.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await apiFetch('/api/accruals/generate-from-open-pos', {
                    method: 'POST',
                    body: '{}',
                  });
                }, 'Accrual proposals refreshed')
              }
            >
              Generate from open POs
            </button>
          </div>

          <div className="procure__stack">
            {accruals.map((a) => (
              <div key={a.id} className="procure__card">
                <div className="procure__card-head">
                  <div>
                    <h3 className="procure__card-title">
                      {a.purchaseOrder?.number ?? 'PO'} · {a.vendorName ?? 'Vendor'}
                    </h3>
                    <p className="procure__card-sub">
                      {formatMoney(a.amountMinor, a.currency)}
                      {a.department ? ` · ${a.department}` : ''}
                      {a.category ? ` · ${a.category}` : ''}
                    </p>
                  </div>
                  <div className="procure__actions">
                    <AccrualStatusBadge status={a.status} />
                    {a.status === 'draft' && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await apiFetch(
                              `/api/accruals/${a.id}/send-for-approval`,
                              { method: 'POST', body: '{}' },
                            );
                          })
                        }
                      >
                        Send for approval
                      </button>
                    )}
                    {a.status === 'in_approval' && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await apiFetch(
                              `/api/accruals/${a.id}/advance-approval`,
                              { method: 'POST', body: '{}' },
                            );
                          })
                        }
                      >
                        Approve (
                        {ACCRUAL_APPROVAL_CHAIN[
                          Math.max(0, (a.approvalStage || 1) - 1)
                        ] ?? 'next'}
                        )
                      </button>
                    )}
                    {a.status === 'approved' && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await apiFetch(`/api/accruals/${a.id}/post-to-erp`, {
                              method: 'POST',
                              body: '{}',
                            });
                          }, 'Posted to ERP')
                        }
                      >
                        Send to ERP
                      </button>
                    )}
                  </div>
                </div>
                {(a.status === 'in_approval' ||
                  a.status === 'approved' ||
                  a.status === 'posted' ||
                  a.approvalStage > 0) && (
                  <ApprovalProgress
                    chain={ACCRUAL_APPROVAL_CHAIN}
                    stage={
                      a.status === 'posted' || a.status === 'approved'
                        ? ACCRUAL_APPROVAL_CHAIN.length + 1
                        : a.approvalStage || 1
                    }
                  />
                )}
              </div>
            ))}
            {accruals.length === 0 && (
              <div className="procure__empty procure__card">
                <div className="procure__empty-icon">▧</div>
                No accrual proposals yet — generate them from open POs
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
