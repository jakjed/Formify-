import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

const DEPARTMENTS = [
  'G&A',
  'R&D',
  'Sales & Marketing',
  'Finance',
  'Operations',
] as const;

const EXPENSE_CATEGORIES = [
  'Software & SaaS',
  'Professional Services',
  'Marketing',
  'Facilities',
  'Travel & Entertainment',
  'Consulting',
] as const;

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
  vendorId: string | null;
  department: string | null;
  category: string | null;
  purchaseOrders: LinkedPo[];
};

type Proposal = {
  id: string;
  number: string;
  title: string;
  valueMinor: number | null;
  currency: string;
  vendor: { id: string; code: string; name: string } | null;
};

type Vendor = { id: string; code: string; name: string };

type ModuleRow = { moduleKey: string; enabled: boolean };

type Tab = 'proposals' | 'requests';
type StatusFilter = 'All' | 'draft' | 'in_approval' | 'approved';

function formatMoney(minor: number | null, currency = 'EUR') {
  if (minor == null) return '—';
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function PurchaseRequestsPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [rows, setRows] = useState<Pr[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [poLicensed, setPoLicensed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [proposalDept, setProposalDept] = useState<Record<string, string>>({});
  const [proposalCat, setProposalCat] = useState<Record<string, string>>({});
  const [proposalTotal, setProposalTotal] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const vendorById = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const v of vendors) map.set(v.id, v);
    return map;
  }, [vendors]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'All') return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  async function refresh() {
    const [prs, mods, vendorRows, proposalRows] = await Promise.all([
      apiFetch<Pr[]>('/api/purchase-requests'),
      apiFetch<ModuleRow[]>('/api/modules').catch(() => [] as ModuleRow[]),
      apiFetch<Vendor[]>('/api/vendors').catch(() => [] as Vendor[]),
      apiFetch<Proposal[]>('/api/purchase-requests/proposals').catch(
        () => [] as Proposal[],
      ),
    ]);
    setRows(prs);
    setPoLicensed(
      mods.some((m) => m.moduleKey === 'purchase_orders' && m.enabled),
    );
    setVendors(vendorRows);
    setProposals(proposalRows);
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
      await apiFetch('/api/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          vendorId: data.get('vendorId') || undefined,
          department: data.get('department') || undefined,
          category: data.get('category') || undefined,
          totalMinor: Number(data.get('totalMinor') || 0) || undefined,
          lines: [
            {
              description: String(data.get('lineDesc') || 'Line 1'),
              quantity: Number(data.get('qty') || 1) || 1,
              unitPriceMinor:
                Number(data.get('unitPriceMinor') || 0) || undefined,
              amountMinor: Number(data.get('totalMinor') || 0) || undefined,
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
      await apiFetch(`/api/purchase-requests/${id}/transition`, {
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

  async function convert(id: string, vendorId?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{
        purchaseOrder: { id: string; number: string };
      }>(`/api/purchase-requests/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          vendorId: vendorId || undefined,
        }),
      });
      setMessage(
        `Converted to ${result.purchaseOrder.number} — open Orders to issue.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert failed');
    } finally {
      setBusy(false);
    }
  }

  async function acceptProposal(contractId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const totalRaw = (proposalTotal[contractId] ?? '').trim();
      await apiFetch(`/api/purchase-requests/proposals/${contractId}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          department: proposalDept[contractId] || undefined,
          category: proposalCat[contractId] || undefined,
          totalMinor: totalRaw
            ? Math.round(parseFloat(totalRaw) * 100)
            : undefined,
        }),
      });
      setMessage('Proposal accepted — PR created in approval.');
      setTab('requests');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accept failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Purchase requests</h1>
      <p className="lede">
        Review contract proposals, raise requests, then convert to a PO draft.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="tabs">
        {(
          [
            ['proposals', 'Proposals'],
            ['requests', 'Purchase Requests'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tabs__btn tabs__btn--active' : 'tabs__btn'}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'proposals' && proposals.length > 0
              ? ` · ${proposals.length}`
              : ''}
          </button>
        ))}
      </div>

      {tab === 'proposals' && (
        <div className="panel">
          <p className="muted">
            Active contracts without a linked PR — accept to create an
            in-approval request.
          </p>
          <ul className="task-list">
            {proposals.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>
                    {p.number} · {p.title}
                  </strong>
                  <span className="muted">
                    {' '}
                    · {p.vendor?.name ?? '—'} ·{' '}
                    {formatMoney(p.valueMinor, p.currency)}
                  </span>
                  <div className="actions" style={{ marginTop: '0.5rem' }}>
                    <select
                      value={proposalDept[p.id] ?? ''}
                      onChange={(e) =>
                        setProposalDept((m) => ({
                          ...m,
                          [p.id]: e.target.value,
                        }))
                      }
                      aria-label="Department"
                    >
                      <option value="">Department</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={proposalCat[p.id] ?? ''}
                      onChange={(e) =>
                        setProposalCat((m) => ({
                          ...m,
                          [p.id]: e.target.value,
                        }))
                      }
                      aria-label="Category"
                    >
                      <option value="">Category</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Total (major)"
                      inputMode="decimal"
                      value={proposalTotal[p.id] ?? ''}
                      onChange={(e) =>
                        setProposalTotal((m) => ({
                          ...m,
                          [p.id]: e.target.value,
                        }))
                      }
                      style={{ width: '8rem' }}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void acceptProposal(p.id)}
                    >
                      Accept
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {proposals.length === 0 && (
              <li className="muted">No proposals waiting for review.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'requests' && (
        <>
          <div className="view-chips" style={{ marginBottom: '1rem' }}>
            {(
              ['All', 'draft', 'in_approval', 'approved'] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                className={
                  statusFilter === s
                    ? 'view-chip view-chip--active'
                    : 'view-chip'
                }
                onClick={() => setStatusFilter(s)}
              >
                {s === 'All' ? 'All' : s}
              </button>
            ))}
          </div>

          <ul className="task-list">
            {filteredRows.map((row) => {
              const linked = row.purchaseOrders?.[0];
              const vendor =
                row.vendorId != null ? vendorById.get(row.vendorId) : null;
              return (
                <li key={row.id}>
                  <div>
                    <strong>
                      {row.number} · {row.title}
                    </strong>
                    <span className="muted"> · {row.status}</span>
                    {row.department && (
                      <span className="muted"> · {row.department}</span>
                    )}
                    {row.category && (
                      <span className="muted"> · {row.category}</span>
                    )}
                    {vendor && (
                      <span className="muted"> · {vendor.name}</span>
                    )}
                    {linked && (
                      <span className="muted">
                        {' '}
                        · PO{' '}
                        <Link to="/purchase-orders">{linked.number}</Link> (
                        {linked.status})
                      </span>
                    )}
                  </div>
                  <div className="actions">
                    {row.status === 'draft' && (
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={busy}
                        onClick={() => void transition(row.id, 'in_approval')}
                      >
                        Submit
                      </button>
                    )}
                    {row.status === 'in_approval' && (
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={busy}
                        onClick={() => void transition(row.id, 'approved')}
                      >
                        Approve
                      </button>
                    )}
                    {row.status === 'approved' && poLicensed && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void convert(row.id)}
                      >
                        Convert to PO
                      </button>
                    )}
                    {row.status === 'approved' && !poLicensed && (
                      <span className="muted">
                        Enable Orders module to convert
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            {filteredRows.length === 0 && (
              <li className="muted">No purchase requests yet.</li>
            )}
          </ul>

          <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
            <label>
              Number
              <input name="number" required placeholder="PR-1001" />
            </label>
            <label>
              Title
              <input name="title" required minLength={2} />
            </label>
            <label>
              Vendor
              <select name="vendorId" defaultValue="">
                <option value="">— none —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select name="department" defaultValue="">
                <option value="">— none —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" defaultValue="">
                <option value="">— none —</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Line description
              <input name="lineDesc" placeholder="Laptops" />
            </label>
            <label>
              Qty
              <input name="qty" type="number" min={1} defaultValue={1} />
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
    </section>
  );
}
