import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type DelegationRecord = {
  id: string;
  fromUserId: string;
  toUserId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  active: boolean;
  fromUser?: { id: string; email: string; displayName: string };
  toUser?: { id: string; email: string; displayName: string };
};

type Candidate = { id: string; email: string; displayName: string };

export function DelegationPage() {
  const [delegations, setDelegations] = useState<{
    outgoing: DelegationRecord[];
    incoming: DelegationRecord[];
  }>({ outgoing: [], incoming: [] });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [rows, users] = await Promise.all([
      apiFetch<{ outgoing: DelegationRecord[]; incoming: DelegationRecord[] }>(
        '/api/delegations',
      ),
      apiFetch<Candidate[]>('/api/delegations/candidates'),
    ]);
    setDelegations(rows);
    setCandidates(users);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/delegations', {
        method: 'POST',
        body: JSON.stringify({
          toUserId: data.get('toUserId'),
          startsAt: new Date(String(data.get('startsAt'))).toISOString(),
          endsAt: new Date(String(data.get('endsAt'))).toISOString(),
          reason: String(data.get('reason') ?? '').trim() || undefined,
        }),
      });
      form.reset();
      setMessage('Delegation created');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delegation failed');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/delegations/${id}`, { method: 'DELETE' });
      setMessage('Delegation revoked');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <h1>My delegation</h1>
          <p className="lede">
            Hand off approval rights while you are away. Active delegates receive
            your approval tasks for the selected window.
          </p>
        </div>
        <Link to="/" className="secondary-btn">
          Back to Command Center
        </Link>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="panel">
        <h2>Create delegation</h2>
        <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
          <label>
            Delegate to
            <select name="toUserId" required defaultValue="">
              <option value="" disabled>
                Select user
              </option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Starts
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label>
            Ends
            <input name="endsAt" type="datetime-local" required />
          </label>
          <label className="span-2">
            Reason
            <input name="reason" placeholder="Vacation, leave, …" />
          </label>
          <div className="span-2 actions">
            <button type="submit" disabled={busy}>
              Create delegation
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Outgoing</h2>
        <ul className="task-list">
          {delegations.outgoing.length === 0 && (
            <li className="muted">No outgoing delegations.</li>
          )}
          {delegations.outgoing.map((d) => {
            const to = d.toUser ?? candidates.find((u) => u.id === d.toUserId);
            return (
              <li key={d.id}>
                <div>
                  <strong>{to?.displayName ?? d.toUserId.slice(0, 8)}</strong>
                  <span className="muted">
                    {' '}
                    · {new Date(d.startsAt).toLocaleString()} →{' '}
                    {new Date(d.endsAt).toLocaleString()}
                    {d.active ? '' : ' · revoked'}
                  </span>
                  {d.reason ? <div className="muted">{d.reason}</div> : null}
                </div>
                {d.active && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => void revoke(d.id)}
                  >
                    Revoke
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="panel">
        <h2>Incoming</h2>
        <ul className="task-list">
          {delegations.incoming.length === 0 && (
            <li className="muted">No incoming delegations.</li>
          )}
          {delegations.incoming.map((d) => {
            const from =
              d.fromUser ?? candidates.find((u) => u.id === d.fromUserId);
            return (
              <li key={d.id}>
                <div>
                  <strong>
                    From {from?.displayName ?? d.fromUserId.slice(0, 8)}
                  </strong>
                  <span className="muted">
                    {' '}
                    · {new Date(d.startsAt).toLocaleString()} →{' '}
                    {new Date(d.endsAt).toLocaleString()}
                  </span>
                  {d.reason ? <div className="muted">{d.reason}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
