import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type Tab =
  | 'users'
  | 'entities'
  | 'modules'
  | 'keys'
  | 'usage'
  | 'mailbox'
  | 'notifications'
  | 'audit';

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

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  lockedUntil: string | null;
  createdAt: string;
};

type EntityRow = { id: string; name: string; code: string };

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type Usage = {
  approvedInvoices: number;
  approvedInvoicesMtd: number;
  ocrPagesThisMonth: number;
  yearMonth: string;
  planName: string;
  approvedSoftLimit: number | null;
  approvedHardLimit: number | null;
  softWarned: boolean;
  hardBlocked: boolean;
};

type ModuleRow = { moduleKey: string; enabled: boolean };

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'entities', label: 'Entities' },
  { id: 'modules', label: 'Modules' },
  { id: 'keys', label: 'API keys' },
  { id: 'usage', label: 'Usage' },
  { id: 'mailbox', label: 'Mailbox' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'audit', label: 'Audit' },
];

const ROLES = ['admin', 'ap_manager', 'ap_clerk', 'approver'] as const;

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [ingests, setIngests] = useState<EmailIngest[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([]);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [m, i, a, n, u, e, k, s, usageRow, mods] = await Promise.all([
      apiFetch<Mailbox>('/api/capture/mailbox'),
      apiFetch<EmailIngest[]>('/api/capture/email-ingests'),
      apiFetch<AuditEvent[]>('/api/audit/events?limit=40'),
      apiFetch<Notification[]>('/api/notifications'),
      apiFetch<UserRow[]>('/api/users'),
      apiFetch<EntityRow[]>('/api/entities'),
      apiFetch<ApiKeyRow[]>('/api/api-keys'),
      apiFetch<string[]>('/api/api-keys/scopes'),
      apiFetch<Usage>('/api/usage/summary'),
      apiFetch<ModuleRow[]>('/api/modules'),
    ]);
    setMailbox(m);
    setIngests(i);
    setEvents(a);
    setNotifications(n);
    setUsers(u);
    setEntities(e);
    setKeys(k);
    setScopes(s);
    setUsage(usageRow);
    setModuleRows(mods);
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

  async function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          displayName: data.get('displayName'),
          password: data.get('password'),
          role: data.get('role'),
        }),
      });
      form.reset();
      setMessage('User created');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create user failed');
    } finally {
      setBusy(false);
    }
  }

  async function onInviteUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    setInviteLink(null);
    try {
      const invited = await apiFetch<{ acceptPath: string }>('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          displayName: data.get('displayName'),
          role: data.get('role'),
        }),
      });
      form.reset();
      setInviteLink(invited.acceptPath);
      setMessage('Invite created — copy the link once');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateEntity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/entities', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          code: data.get('code'),
        }),
      });
      form.reset();
      setMessage('Entity created');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create entity failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateKey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const selected = scopes.filter((s) => data.get(`scope-${s}`) === 'on');
    setBusy(true);
    setError(null);
    setMessage(null);
    setNewKeyToken(null);
    try {
      const created = await apiFetch<{ token: string }>('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          scopes: selected,
        }),
      });
      form.reset();
      setNewKeyToken(created.token);
      setMessage('API key created — copy the token now');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create key failed');
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/api-keys/${id}/revoke`, { method: 'POST' });
      setMessage('API key revoked');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSavePlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const softRaw = String(data.get('soft') ?? '').trim();
    const hardRaw = String(data.get('hard') ?? '').trim();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/plan', {
        method: 'PATCH',
        body: JSON.stringify({
          planName: data.get('planName'),
          approvedSoftLimit: softRaw === '' ? null : Number(softRaw),
          approvedHardLimit: hardRaw === '' ? null : Number(hardRaw),
        }),
      });
      setMessage('Plan updated');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Platform</p>
      <h1>Admin</h1>
      <p className="lede">
        Users, entities, API keys, usage limits, capture mailbox, and audit.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tabs__btn tabs__btn--active' : 'tabs__btn'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="panel">
          <h2>Users</h2>
          {inviteLink && (
            <p className="ok">
              Invite link (copy once): <code>{inviteLink}</code>
            </p>
          )}
          <ul className="task-list">
            {users.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.displayName}</strong>
                  <span className="muted">
                    {' '}
                    · {u.email} · {u.role} · {u.status}
                    {u.lockedUntil ? ` · locked until ${u.lockedUntil}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <h3>Invite user</h3>
          <form className="workspace-form" onSubmit={(e) => void onInviteUser(e)}>
            <label>
              Display name
              <input name="displayName" required minLength={2} />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Role
              <select name="role" defaultValue="ap_clerk">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Send invite
              </button>
            </div>
          </form>
          <h3>Create user (with password)</h3>
          <form className="workspace-form" onSubmit={(e) => void onCreateUser(e)}>
            <label>
              Display name
              <input name="displayName" required minLength={2} />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" required minLength={8} />
            </label>
            <label>
              Role
              <select name="role" defaultValue="ap_clerk">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Add user
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'entities' && (
        <div className="panel">
          <h2>Entities</h2>
          <ul className="task-list">
            {entities.map((ent) => (
              <li key={ent.id}>
                <div>
                  <strong>{ent.name}</strong>
                  <span className="muted"> · {ent.code}</span>
                </div>
              </li>
            ))}
          </ul>
          <form className="workspace-form" onSubmit={(e) => void onCreateEntity(e)}>
            <label>
              Name
              <input name="name" required minLength={2} />
            </label>
            <label>
              Code
              <input name="code" required minLength={1} />
            </label>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Add entity
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'modules' && (
        <div className="panel">
          <h2>Module licenses</h2>
          <p className="lede">
            Enable Phase 2 procure modules independently. Invoices stays on.
          </p>
          <ul className="task-list">
            {moduleRows.map((mod) => (
              <li key={mod.moduleKey}>
                <div>
                  <strong>{mod.moduleKey}</strong>
                  <span className="muted">
                    {' '}
                    · {mod.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={busy || mod.moduleKey === 'invoices'}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await apiFetch(`/api/modules/${mod.moduleKey}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ enabled: !mod.enabled }),
                        });
                        setMessage(
                          `${mod.moduleKey} ${!mod.enabled ? 'enabled' : 'disabled'}`,
                        );
                        await refresh();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : 'Update failed',
                        );
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  {mod.enabled ? 'Disable' : 'Enable'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'keys' && (
        <div className="panel">
          <h2>API keys</h2>
          {newKeyToken && (
            <p className="ok">
              Token (copy once): <code>{newKeyToken}</code>
            </p>
          )}
          <ul className="task-list">
            {keys.map((k) => (
              <li key={k.id}>
                <div>
                  <strong>{k.name}</strong>
                  <span className="muted">
                    {' '}
                    · aptora_{k.prefix}… · {k.scopes.join(', ')}
                    {k.revokedAt ? ' · revoked' : ''}
                  </span>
                </div>
                {!k.revokedAt && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => void revokeKey(k.id)}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form className="workspace-form" onSubmit={(e) => void onCreateKey(e)}>
            <label className="span-2">
              Name
              <input name="name" required minLength={2} placeholder="ERP sync" />
            </label>
            <div className="span-2">
              <p className="muted">Scopes</p>
              {scopes.map((s) => (
                <label key={s} style={{ display: 'block', marginBottom: '0.35rem' }}>
                  <input type="checkbox" name={`scope-${s}`} defaultChecked={s === 'invoices:read'} />{' '}
                  {s}
                </label>
              ))}
            </div>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Create key
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'usage' && usage && (
        <div className="panel">
          <h2>Usage &amp; plan</h2>
          <dl className="kv">
            <dt>Plan</dt>
            <dd>{usage.planName}</dd>
            <dt>Approved MTD</dt>
            <dd>
              {usage.approvedInvoicesMtd}
              {usage.approvedSoftLimit != null
                ? ` / soft ${usage.approvedSoftLimit}`
                : ''}
              {usage.approvedHardLimit != null
                ? ` / hard ${usage.approvedHardLimit}`
                : ''}
            </dd>
            <dt>Approved all-time</dt>
            <dd>{usage.approvedInvoices}</dd>
            <dt>OCR pages ({usage.yearMonth})</dt>
            <dd>{usage.ocrPagesThisMonth}</dd>
          </dl>
          {usage.softWarned && (
            <p className="error">Soft limit reached — consider upgrading.</p>
          )}
          {usage.hardBlocked && (
            <p className="error">Hard limit reached — approvals blocked.</p>
          )}
          <form className="workspace-form" onSubmit={(e) => void onSavePlan(e)}>
            <label>
              Plan name
              <input name="planName" defaultValue={usage.planName} required />
            </label>
            <label>
              Soft limit (MTD)
              <input
                name="soft"
                type="number"
                min={0}
                defaultValue={usage.approvedSoftLimit ?? ''}
              />
            </label>
            <label>
              Hard limit (MTD)
              <input
                name="hard"
                type="number"
                min={0}
                defaultValue={usage.approvedHardLimit ?? ''}
              />
            </label>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Save plan
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'mailbox' && (
        <>
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
        </>
      )}

      {tab === 'notifications' && (
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
      )}

      {tab === 'audit' && (
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
      )}
    </section>
  );
}
