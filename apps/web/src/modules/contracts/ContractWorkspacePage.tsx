import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type Contract = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  valueMinor: number | null;
  vendorId: string | null;
  entityId: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  vendor: { id: string; code: string; name: string } | null;
  entity: { id: string; code: string; name: string } | null;
};

type Vendor = { id: string; code: string; name: string };
type Entity = { id: string; code: string; name: string };

type ActivityItem =
  | {
      id: string;
      kind: 'audit';
      at: string;
      actorName: string | null;
      action: string;
    }
  | {
      id: string;
      kind: 'comment';
      at: string;
      actorName: string | null;
      body: string;
    };

type Comment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

function formatAction(action: string) {
  const labels: Record<string, string> = {
    'contract.created': 'Created contract',
    'contract.updated': 'Updated contract fields',
    'contract.status': 'Changed status',
    'contract.amended': 'Amended contract',
    'contract.renewed': 'Renewed end date',
  };
  return labels[action] ?? action.replace(/\./g, ' ');
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function fromMajor(value: string): number | null {
  if (value.trim() === '') return null;
  return Math.round(parseFloat(value) * 100);
}

function toMajor(minor: number | null): string {
  if (minor == null) return '';
  return (minor / 100).toFixed(2);
}

export function ContractWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');

  const [title, setTitle] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  function applyContract(row: Contract) {
    setContract(row);
    setTitle(row.title);
    setVendorId(row.vendorId ?? '');
    setEntityId(row.entityId ?? '');
    setCurrency(row.currency);
    setStartDate(toDateInput(row.startDate));
    setEndDate(toDateInput(row.endDate));
    setValue(toMajor(row.valueMinor));
    setNotes(row.notes ?? '');
  }

  async function loadSidePanels(contractId: string) {
    const [activityRows, commentRows] = await Promise.all([
      apiFetch<ActivityItem[]>(`/api/contracts/${contractId}/activity`),
      apiFetch<Comment[]>(`/api/contracts/${contractId}/comments`),
    ]);
    setActivity(activityRows);
    setComments(commentRows);
  }

  async function refresh() {
    if (!id) return;
    const [row, vendorRows, entityRows] = await Promise.all([
      apiFetch<Contract>(`/api/contracts/${id}`),
      apiFetch<Vendor[]>('/api/vendors'),
      apiFetch<Entity[]>('/api/entities'),
    ]);
    applyContract(row);
    setVendors(vendorRows);
    setEntities(entityRows);
    await loadSidePanels(id);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id || !contract) return;
    setError(null);
    setMessage(null);
    try {
      const body = {
        title,
        vendorId: vendorId || null,
        entityId: entityId || null,
        currency,
        valueMinor: fromMajor(value),
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes || null,
      };
      const row =
        contract.status === 'active'
          ? await apiFetch<Contract>(`/api/contracts/${id}/amend`, {
              method: 'POST',
              body: JSON.stringify({
                title: body.title,
                valueMinor: body.valueMinor,
                startDate: body.startDate,
                endDate: body.endDate,
                notes: body.notes,
              }),
            })
          : await apiFetch<Contract>(`/api/contracts/${id}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            });
      applyContract(row);
      setMessage(contract.status === 'active' ? 'Amended.' : 'Saved.');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function transition(status: string) {
    if (!id) return;
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(`/api/contracts/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      applyContract(row);
      setMessage(`Status → ${status}`);
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  async function onRenew() {
    if (!id || !renewEndDate) return;
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(`/api/contracts/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify({ endDate: renewEndDate }),
      });
      applyContract(row);
      setMessage('Renewed.');
      setRenewEndDate('');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Renew failed');
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault();
    if (!id || !commentBody.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/contracts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody('');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed');
    }
  }

  if (!contract) {
    return (
      <section className="page">
        <p className="eyebrow">Procure</p>
        <h1>Contract</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
      </section>
    );
  }

  const locked = contract.status === 'expired' || contract.status === 'cancelled';
  const isActive = contract.status === 'active';

  return (
    <section className="page">
      <p className="eyebrow">Contract workspace</p>
      <h1>
        {contract.number} · {contract.title}
      </h1>
      <p className="lede">
        Status <strong>{contract.status}</strong>
        {contract.vendor ? ` · ${contract.vendor.name}` : ''}
      </p>

      <form className="workspace-form" onSubmit={(e) => void onSave(e)}>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={locked}
            required
            minLength={2}
          />
        </label>
        <label>
          Vendor
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            disabled={locked || isActive}
          >
            <option value="">— none —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entity
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            disabled={locked || isActive}
          >
            <option value="">— none —</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.code} — {ent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
            disabled={locked || isActive}
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={locked}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={locked}
          />
        </label>
        <label>
          Value
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            disabled={locked}
          />
        </label>
        <label className="span-2">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={locked}
          />
        </label>

        {error && <p className="error span-2">{error}</p>}
        {message && <p className="ok span-2">{message}</p>}

        <div className="span-2 actions">
          {!locked && (
            <button type="submit">{isActive ? 'Amend' : 'Save'}</button>
          )}
          {contract.status === 'draft' && (
            <>
              <button type="button" onClick={() => void transition('in_approval')}>
                Submit for approval
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          {contract.status === 'in_approval' && (
            <>
              <button type="button" onClick={() => void transition('active')}>
                Activate
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('draft')}
              >
                Send back
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          {isActive && (
            <>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('expired')}
              >
                Expire
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate('/contracts')}
          >
            Back to list
          </button>
        </div>
      </form>

      {isActive && (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h2>Renew</h2>
          <div className="actions">
            <input
              type="date"
              value={renewEndDate}
              onChange={(e) => setRenewEndDate(e.target.value)}
            />
            <button type="button" onClick={() => void onRenew()} disabled={!renewEndDate}>
              Extend end date
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Activity</h2>
        {activity.length === 0 && <p className="muted">No activity yet.</p>}
        <ul className="activity-feed">
          {activity.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <span className="activity-feed__time">
                {new Date(item.at).toLocaleString()}
              </span>
              <span className="activity-feed__actor">
                {item.actorName ?? 'System'}
              </span>
              {item.kind === 'comment' ? (
                <p className="activity-feed__body">{item.body}</p>
              ) : (
                <p className="activity-feed__body">{formatAction(item.action)}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Comments</h2>
        {comments.length === 0 && <p className="muted">No comments yet.</p>}
        <ul className="task-list">
          {comments.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.authorName}</strong>
                <span className="muted">
                  {' '}
                  · {new Date(c.createdAt).toLocaleString()}
                </span>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <form className="workspace-form" onSubmit={(e) => void onComment(e)}>
          <label className="span-2">
            Add comment
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              required
            />
          </label>
          <div className="span-2 actions">
            <button type="submit">Post</button>
          </div>
        </form>
      </div>

      <p style={{ marginTop: '1rem' }}>
        <Link to="/contracts">← Contracts</Link>
      </p>
    </section>
  );
}
