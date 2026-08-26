import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type Mailbox = {
  id: string;
  address: string;
  token: string;
  enabled: boolean;
  ingestPath: string;
  createdAt: string;
  rotatedAt: string | null;
};

type EmailIngest = {
  id: string;
  messageId: string;
  fromAddress: string | null;
  subject: string | null;
  status: string;
  invoiceId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  createdAt: string;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function AdminPage() {
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [ingests, setIngests] = useState<EmailIngest[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [m, i, a, n] = await Promise.all([
      apiFetch<Mailbox>('/api/capture/mailbox'),
      apiFetch<EmailIngest[]>('/api/capture/email-ingests'),
      apiFetch<AuditEvent[]>('/api/audit/events?limit=40'),
      apiFetch<Notification[]>('/api/notifications'),
    ]);
    setMailbox(m);
    setIngests(i);
    setEvents(a);
    setNotifications(n);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function rotateToken() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await apiFetch<Mailbox>('/api/capture/mailbox/rotate', {
        method: 'POST',
      });
      setMailbox(next);
      setMessage('Mailbox token rotated');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotate failed');
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    await refresh();
  }

  return (
    <section className="page">
      <p className="eyebrow">Platform</p>
      <h1>Admin</h1>
      <p className="lede">
        Capture mailbox, in-app notifications, and append-only audit trail.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="panel">
        <h2>Invoice mailbox</h2>
        {!mailbox && <p className="muted">Loading…</p>}
        {mailbox && (
          <>
            <p>
              Forward invoices to <code>{mailbox.address}</code> (simulated).
              Providers POST attachments to the ingest path below.
            </p>
            <dl className="kv">
              <dt>Ingest path</dt>
              <dd>
                <code>{mailbox.ingestPath}</code>
              </dd>
              <dt>Token</dt>
              <dd>
                <code className="token-mask">{mailbox.token}</code>
              </dd>
              <dt>Status</dt>
              <dd>{mailbox.enabled ? 'Enabled' : 'Disabled'}</dd>
            </dl>
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={() => void rotateToken()}
            >
              Rotate token
            </button>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Email ingests</h2>
        {ingests.length === 0 && <p className="muted">No inbound email yet.</p>}
        <ul className="task-list">
          {ingests.map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.subject ?? row.messageId}</strong>
                <span className="muted">
                  {' '}
                  · {row.status}
                  {row.fromAddress ? ` · ${row.fromAddress}` : ''}
                </span>
                {row.invoiceId && (
                  <>
                    {' '}
                    <Link to={`/invoices/${row.invoiceId}`}>Open invoice</Link>
                  </>
                )}
                {row.errorMessage && (
                  <p className="error">{row.errorMessage}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2>Notifications</h2>
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => void markAllRead()}
          >
            Mark all read
          </button>
        </div>
        {notifications.length === 0 && (
          <p className="muted">No notifications yet.</p>
        )}
        <ul className="task-list">
          {notifications.map((n) => (
            <li key={n.id} className={n.readAt ? undefined : 'task-list__unread'}>
              <div>
                <strong>{n.title}</strong>
                {n.body && <span className="muted"> — {n.body}</span>}
                {n.href && (
                  <>
                    {' '}
                    <Link to={n.href}>View</Link>
                  </>
                )}
              </div>
              {!n.readAt && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => void markRead(n.id)}
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Audit log</h2>
        {events.length === 0 && <p className="muted">No events yet.</p>}
        <ul className="task-list">
          {events.map((ev) => (
            <li key={ev.id}>
              <div>
                <code>{ev.action}</code>
                <span className="muted">
                  {' '}
                  · {ev.entityType}
                  {ev.entityId ? ` ${ev.entityId.slice(0, 8)}…` : ''}
                  {' · '}
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
