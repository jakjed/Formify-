import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/lib/api';

type Contract = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  valueMinor: number | null;
  createdAt: string;
};

export function ContractsPage() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setRows(await apiFetch<Contract[]>('/api/contracts'));
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
      await apiFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          valueMinor: Number(data.get('valueMinor') || 0) || undefined,
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
      await apiFetch(`/api/contracts/${id}/transition`, {
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
      <h1>Contracts</h1>
      <p className="lede">Vendor agreements — draft through active.</p>
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
                  onClick={() => void transition(row.id, 'active')}
                >
                  Activate
                </button>
              )}
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
          Value (minor units)
          <input name="valueMinor" type="number" min={0} placeholder="100000" />
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
