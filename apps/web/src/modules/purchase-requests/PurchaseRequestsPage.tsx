import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import { appendEntityParam, formatEntityCell } from '../../shared/lib/entity';
import {
  DEPARTMENTS,
  EXPENSE_CATEGORIES,
  PR_APPROVAL_CHAIN,
  PrStatusBadge,
  ApprovalProgress,
  ProcureKpis,
  ProcureTabs,
  formatMoney,
} from '../procure/shared';

type LinkedPo = {
  id: string;
  number: string;
  status: string;
  title: string;
};

type Pr = {
  id: string;
  number: string;
  title: string;
  status: string;
  totalMinor: number | null;
  currency?: string;
  department: string | null;
  category: string | null;
  vendorId?: string | null;
  entityId?: string | null;
  approvalStage?: number;
  purchaseOrders: LinkedPo[];
};

type Proposal = {
  id: string;
  number: string;
  title: string;
  status: string;
  valueMinor: number | null;
  currency: string;
  vendor: { id: string; code: string; name: string } | null;
};

type Vendor = { id: string; code: string; name: string };
type ModuleRow = { moduleKey: string; enabled: boolean };
type Tab = 'proposals' | 'requests';
type Filter = 'All' | 'draft' | 'in_approval' | 'approved' | 'converted';

export function PurchaseRequestsPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [rows, setRows] = useState<Pr[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [poLicensed, setPoLicensed] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    appendEntityParam(params);
    const [prs, mods, vendorRows, props] = await Promise.all([
      apiFetch<Pr[]>(`/api/purchase-requests?${params}`),
      apiFetch<ModuleRow[]>('/api/modules').catch(() => [] as ModuleRow[]),
      apiFetch<Vendor[]>('/api/vendors').catch(() => [] as Vendor[]),
      apiFetch<Proposal[]>('/api/purchase-requests/proposals').catch(
        () => [] as Proposal[],
      ),
    ]);
    setRows(prs);
    setProposals(props);
    setVendors(vendorRows);
    setPoLicensed(
      mods.some((m) => m.moduleKey === 'purchase_orders' && m.enabled),
    );
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

  const filtered = useMemo(
    () => (filter === 'All' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const kpis = useMemo(
    () => [
      { label: 'Proposals', value: proposals.length },
      {
        label: 'In approval',
        value: rows.filter((r) => r.status === 'in_approval').length,
      },
      {
        label: 'Approved',
        value: rows.filter((r) => r.status === 'approved').length,
      },
      {
        label: 'Converted',
        value: rows.filter((r) => r.status === 'converted').length,
      },
    ],
    [rows, proposals],
  );

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
    const total = Number(data.get('totalMinor') || 0) || undefined;
    await run(async () => {
      await apiFetch('/api/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          vendorId: data.get('vendorId') || undefined,
          department: data.get('department') || undefined,
          category: data.get('category') || undefined,
          totalMinor: total,
          lines: [
            {
              description: String(data.get('lineDesc') || 'Line 1'),
              quantity: Number(data.get('qty') || 1) || 1,
              unitPriceMinor: Number(data.get('unitPriceMinor') || 0) || undefined,
              amountMinor: total,
            },
          ],
        }),
      });
      form.reset();
      setShowNew(false);
    }, 'Purchase request created');
  }

  async function onUpdate(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const totalRaw = String(data.get('totalMinor') ?? '').trim();
    await run(async () => {
      await apiFetch(`/api/purchase-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.get('title'),
          vendorId: data.get('vendorId') || null,
          department: data.get('department') || undefined,
          category: data.get('category') || undefined,
          ...(totalRaw === ''
            ? {}
            : { totalMinor: Number(totalRaw) || 0 }),
        }),
      });
      setEditingId(null);
    }, 'Purchase request updated');
  }

  return (
    <section className="page procure">
      <div className="procure__header">
        <div className="procure__header-copy">
          <p className="eyebrow">Procure</p>
          <h1>Purchase requests</h1>
          <p className="lede">
            Review AI proposals from signed contracts, approve spend, then convert to
            a purchase order.
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
          { id: 'proposals', label: 'PR proposals', count: proposals.length },
          { id: 'requests', label: 'Purchase requests', count: rows.length },
        ]}
      />

      {tab === 'proposals' && (
        <>
          <div className="procure__notice procure__notice--info">
            Proposals are drafted from active signed contracts that do not yet have a
            linked purchase request. Adjust coding, then send into approval.
          </div>
          <div className="procure__stack">
            {proposals.map((p) => (
              <div key={p.id} className="procure__card">
                <div className="procure__card-head">
                  <div>
                    <h3 className="procure__card-title">
                      {p.number} · {p.vendor?.name ?? p.title}
                    </h3>
                    <p className="procure__card-sub">
                      {formatMoney(p.valueMinor, p.currency)} · from signed agreement
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await apiFetch(
                          `/api/purchase-requests/proposals/${p.id}/accept`,
                          {
                            method: 'POST',
                            body: JSON.stringify({
                              department: 'R&D',
                              category: 'Software & SaaS',
                              totalMinor: p.valueMinor ?? undefined,
                            }),
                          },
                        );
                        setTab('requests');
                      }, 'Proposal accepted into approval')
                    }
                  >
                    Send for approval
                  </button>
                </div>
                <p className="procure__muted" style={{ margin: 0 }}>
                  {p.title}
                </p>
              </div>
            ))}
            {proposals.length === 0 && (
              <div className="procure__empty procure__card">
                <div className="procure__empty-icon">✓</div>
                No AI proposals waiting — execute a contract to seed one
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'requests' && (
        <>
          <div className="procure__toolbar">
            <div className="procure__toolbar-left">
              {(['All', 'draft', 'in_approval', 'approved', 'converted'] as Filter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    className={`procure__tab${filter === f ? ' procure__tab--active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'All' ? 'All' : f.replace(/_/g, ' ')}
                  </button>
                ),
              )}
            </div>
            <div className="procure__toolbar-right">
              <span className="procure__muted">
                {filtered.length} requests ·{' '}
                {formatMoney(
                  filtered.reduce((s, r) => s + (r.totalMinor ?? 0), 0),
                )}
              </span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setShowNew((v) => !v)}
              >
                + New purchase request
              </button>
            </div>
          </div>

          {showNew && (
            <div className="procure__composer">
              <h3>New purchase request</h3>
              <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
                <label>
                  Number
                  <input name="number" required placeholder="PR-5010" />
                </label>
                <label>
                  Title
                  <input name="title" required placeholder="Cloud capacity Q4" />
                </label>
                <label>
                  Vendor
                  <select name="vendorId" defaultValue="">
                    <option value="">—</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Department
                  <select name="department" defaultValue={DEPARTMENTS[0]}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <select name="category" defaultValue={EXPENSE_CATEGORIES[0]}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount (minor)
                  <input name="totalMinor" type="number" placeholder="4200000" />
                </label>
                <label className="span-2">
                  Line description
                  <input name="lineDesc" placeholder="Subscription" />
                </label>
                <input type="hidden" name="qty" value="1" />
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
            const p = rows.find((r) => r.id === editingId);
            if (!p) return null;
            return (
              <div className="procure__composer">
                <h3>Edit {p.number}</h3>
                <form
                  className="workspace-form"
                  onSubmit={(e) => void onUpdate(e, p.id)}
                >
                  <label>
                    Title
                    <input name="title" required defaultValue={p.title} />
                  </label>
                  <label>
                    Vendor
                    <select name="vendorId" defaultValue={p.vendorId ?? ''}>
                      <option value="">—</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Department
                    <select
                      name="department"
                      defaultValue={p.department ?? DEPARTMENTS[0]}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Category
                    <select
                      name="category"
                      defaultValue={p.category ?? EXPENSE_CATEGORIES[0]}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount (minor)
                    <input
                      name="totalMinor"
                      type="number"
                      defaultValue={p.totalMinor ?? ''}
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
                    <th>PR</th>
                    <th>Entity</th>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>PO</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const po = p.purchaseOrders?.[0];
                    const canEdit =
                      p.status === 'draft' || p.status === 'in_approval';
                    return (
                      <tr key={p.id}>
                        <td className="procure__mono">{p.number}</td>
                        <td className="procure__mono">
                          {formatEntityCell(p.entityId)}
                        </td>
                        <td>
                          {p.title}
                          {p.status === 'in_approval' && (
                            <div style={{ marginTop: '0.65rem' }}>
                              <ApprovalProgress
                                chain={PR_APPROVAL_CHAIN}
                                stage={p.approvalStage || 1}
                              />
                            </div>
                          )}
                        </td>
                        <td>{p.department ?? '—'}</td>
                        <td>{p.category ?? '—'}</td>
                        <td className="procure__mono">
                          {formatMoney(p.totalMinor, p.currency ?? 'EUR')}
                        </td>
                        <td>
                          <PrStatusBadge status={p.status} />
                        </td>
                        <td className="procure__mono">
                          {po ? (
                            <Link to="/purchase-orders">{po.number}</Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div className="procure__actions">
                            {canEdit && (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                disabled={busy}
                                onClick={() => {
                                  setShowNew(false);
                                  setEditingId(p.id);
                                }}
                              >
                                Edit
                              </button>
                            )}
                            {p.status === 'draft' && (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await apiFetch(
                                      `/api/purchase-requests/${p.id}/transition`,
                                      {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          status: 'in_approval',
                                        }),
                                      },
                                    );
                                  })
                                }
                              >
                                Submit
                              </button>
                            )}
                            {p.status === 'in_approval' && (
                              <button
                                type="button"
                                className="btn btn--primary"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await apiFetch(
                                      `/api/purchase-requests/${p.id}/transition`,
                                      {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          status: 'approved',
                                        }),
                                      },
                                    );
                                  }, 'Approved')
                                }
                              >
                                Approve
                              </button>
                            )}
                            {p.status === 'approved' && poLicensed && !po && (
                              <button
                                type="button"
                                className="btn btn--primary"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await apiFetch(
                                      `/api/purchase-requests/${p.id}/convert`,
                                      {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          vendorId: p.vendorId || undefined,
                                        }),
                                      },
                                    );
                                  }, 'Converted to PO')
                                }
                              >
                                Convert to PO
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="procure__empty">No purchase requests here</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
