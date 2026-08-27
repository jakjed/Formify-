import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type Contract = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  valueMinor: number | null;
  vendor: { id: string; code: string; name: string } | null;
  createdAt: string;
};

type Vendor = { id: string; code: string; name: string };

export function ContractsPage() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [contracts, vendorRows] = await Promise.all([
      apiFetch<Contract[]>('/api/contracts'),
      apiFetch<Vendor[]>('/api/vendors'),
    ]);
    setRows(contracts);
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
    try {
      const valueRaw = String(data.get('value') || '').trim();
      await apiFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          vendorId: data.get('vendorId') || undefined,
          startDate: data.get('startDate') || undefined,
          endDate: data.get('endDate') || undefined,
          valueMinor: valueRaw
            ? Math.round(parseFloat(valueRaw) * 100)
            : undefined,
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

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Contracts</h1>
      <p className="lede">Vendor agreements — draft through active.</p>
      {error && <p className="error">{error}</p>}
      <ul className="task-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>
                <Link to={`/contracts/${row.id}`}>
                  {row.number} · {row.title}
                </Link>
              </strong>
              <span className="muted">
                {' '}
                · {row.status}
                {row.vendor ? ` · ${row.vendor.name}` : ''}
              </span>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">No contracts yet.</li>}
      </ul>
      <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
        <label>
          Number
          <input name="number" required placeholder="C-1001" />
        </label>
        <label>
          Title
          <input name="title" required minLength={2} placeholder="Office supply MSA" />
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
          Value
          <input name="value" inputMode="decimal" placeholder="1000.00" />
        </label>
        <label>
          Start
          <input name="startDate" type="date" />
        </label>
        <label>
          End
          <input name="endDate" type="date" />
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
