import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

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
  purchaseOrders: LinkedPo[];
};

type Vendor = { id: string; code: string; name: string };

type ModuleRow = { moduleKey: string; enabled: boolean };

export function PurchaseRequestsPage() {
  const [rows, setRows] = useState<Pr[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [poLicensed, setPoLicensed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [prs, mods, vendorRows] = await Promise.all([
      apiFetch<Pr[]>('/api/purchase-requests'),
      apiFetch<ModuleRow[]>('/api/modules').catch(() => [] as ModuleRow[]),
      apiFetch<Vendor[]>('/api/vendors').catch(() => [] as Vendor[]),
    ]);
    setRows(prs);
    setPoLicensed(
      mods.some((m) => m.moduleKey === 'purchase_orders' && m.enabled),
    );
    setVendors(vendorRows);
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
          totalMinor: Number(data.get('totalMinor') || 0) || undefined,
          lines: [
            {
              description: String(data.get('lineDesc') || 'Line 1'),
              quantity: Number(data.get('qty') || 1) || 1,
              unitPriceMinor: Number(data.get('unitPriceMinor') || 0) || undefined,
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

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Purchase requests</h1>
      <p className="lede">Raise and approve requests, then convert to a PO draft.</p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}
      <ul className="task-list">
        {rows.map((row) => {
          const linked = row.purchaseOrders?.[0];
          return (
            <li key={row.id}>
              <div>
                <strong>
                  {row.number} · {row.title}
                </strong>
                <span className="muted"> · {row.status}</span>
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
                  <span className="muted">Enable Orders module to convert</span>
                )}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="muted">No purchase requests yet.</li>}
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
        {vendors.length > 0 && (
          <label className="span-2 muted">
            Vendors available for convert (optional at convert time)
          </label>
        )}
        <div className="span-2 actions">
          <button type="submit" disabled={busy}>
            Create draft
          </button>
        </div>
      </form>
    </section>
  );
}
