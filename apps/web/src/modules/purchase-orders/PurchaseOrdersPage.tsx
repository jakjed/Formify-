import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/lib/api';

type Po = {
  id: string;
  number: string;
  title: string;
  status: string;
  totalMinor: number | null;
};

export function PurchaseOrdersPage() {
  const [rows, setRows] = useState<Po[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    try {
      await apiFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          totalMinor: Number(data.get('totalMinor') || 0) || undefined,
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

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Purchase orders</h1>
      <p className="lede">Issue and receive orders — match into invoices later.</p>
      {error && <p className="error">{error}</p>}
      <ul className="task-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>
                {row.number} · {row.title}
              </strong>
              <span className="muted"> · {row.status}</span>
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
              {row.status === 'issued' && (
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={busy}
                  onClick={() => void transition(row.id, 'received')}
                >
                  Mark received
                </button>
              )}
            </div>
          </li>
        ))}
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
