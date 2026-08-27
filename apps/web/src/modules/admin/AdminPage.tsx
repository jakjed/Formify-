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
  | 'webhooks'
  | 'sso'
  | 'notifications'
  | 'audit'
  | 'workflow';

type ApprovalPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  autoApproveUnderMinor: number | null;
};

type ApprovalRule = {
  id: string;
  name: string;
  entityId: string | null;
  minMinor: number | null;
  maxMinor: number | null;
  autoApprove: boolean;
  assigneeRole: string | null;
  priority: number;
  enabled: boolean;
};

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

type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  createdAt: string;
};

type WebhookDelivery = {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  httpStatus: number | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
};

type OidcAdmin = {
  type: string;
  enabled: boolean;
  clientSecretSet: boolean;
  settings: {
    issuer?: string;
    clientId?: string;
    scopes?: string;
    displayName?: string;
    mode?: string;
    mockEmail?: string;
  };
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'entities', label: 'Entities' },
  { id: 'modules', label: 'Modules' },
  { id: 'keys', label: 'API keys' },
  { id: 'usage', label: 'Usage' },
  { id: 'mailbox', label: 'Mailbox' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'sso', label: 'SSO' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'audit', label: 'Audit' },
  { id: 'workflow', label: 'Approvals' },
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
  const [webhookEndpoints, setWebhookEndpoints] = useState<WebhookEndpoint[]>(
    [],
  );
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>(
    [],
  );
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [oidc, setOidc] = useState<OidcAdmin | null>(null);
  const [policy, setPolicy] = useState<ApprovalPolicy | null>(null);
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([]);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [
      m,
      i,
      a,
      n,
      u,
      e,
      k,
      s,
      usageRow,
      mods,
      wh,
      whe,
      whd,
      providers,
      pol,
      rules,
    ] = await Promise.all([
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
      apiFetch<WebhookEndpoint[]>('/api/webhooks/endpoints').catch(
        () => [] as WebhookEndpoint[],
      ),
      apiFetch<string[]>('/api/webhooks/events').catch(() => [] as string[]),
      apiFetch<WebhookDelivery[]>('/api/webhooks/deliveries').catch(
        () => [] as WebhookDelivery[],
      ),
      apiFetch<OidcAdmin[]>('/api/auth/providers/admin').catch(
        () => [] as OidcAdmin[],
      ),
      apiFetch<ApprovalPolicy>('/api/workflow/policy').catch(
        () => null as ApprovalPolicy | null,
      ),
      apiFetch<ApprovalRule[]>('/api/workflow/rules').catch(
        () => [] as ApprovalRule[],
      ),
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
    setWebhookEndpoints(wh);
    setWebhookEvents(whe);
    setWebhookDeliveries(whd);
    setOidc(providers.find((p) => p.type === 'oidc') ?? null);
    setPolicy(pol);
    setApprovalRules(rules);
  }

  async function loadWorkflowTab() {
    const [e, rules, pol] = await Promise.all([
      apiFetch<EntityRow[]>('/api/entities'),
      apiFetch<ApprovalRule[]>('/api/workflow/rules'),
      apiFetch<ApprovalPolicy>('/api/workflow/policy').catch(
        () => null as ApprovalPolicy | null,
      ),
    ]);
    setEntities(e);
    setApprovalRules(rules);
    setPolicy(pol);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (tab !== 'workflow') return;
    void loadWorkflowTab().catch((err: Error) => setError(err.message));
  }, [tab]);

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

  async function onSavePolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const majorRaw = String(data.get('autoApproveUnderMajor') ?? '').trim();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<ApprovalPolicy>('/api/workflow/policy', {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.get('name'),
          enabled: data.get('enabled') === 'on',
          autoApproveUnderMinor:
            majorRaw === '' ? null : Math.round(Number(majorRaw) * 100),
        }),
      });
      setPolicy(updated);
      setMessage('Approval policy updated');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Policy update failed');
    } finally {
      setBusy(false);
    }
  }

  function formatMajor(minor: number | null): string {
    if (minor == null) return '—';
    return (minor / 100).toFixed(2);
  }

  function entityLabel(entityId: string | null): string {
    if (!entityId) return 'All entities';
    const ent = entities.find((row) => row.id === entityId);
    return ent ? `${ent.code} / ${ent.name}` : entityId.slice(0, 8) + '…';
  }

  async function onCreateRule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const minRaw = String(data.get('minMajor') ?? '').trim();
    const maxRaw = String(data.get('maxMajor') ?? '').trim();
    const entityRaw = String(data.get('entityId') ?? '').trim();
    const roleRaw = String(data.get('assigneeRole') ?? '').trim();
    const priorityRaw = String(data.get('priority') ?? '').trim();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<ApprovalRule>('/api/workflow/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          entityId: entityRaw === '' ? null : entityRaw,
          minMinor: minRaw === '' ? null : Math.round(Number(minRaw) * 100),
          maxMinor: maxRaw === '' ? null : Math.round(Number(maxRaw) * 100),
          autoApprove: data.get('autoApprove') === 'on',
          assigneeRole: roleRaw === '' ? null : roleRaw,
          priority: priorityRaw === '' ? 100 : Number(priorityRaw),
          enabled: data.get('enabled') === 'on',
        }),
      });
      form.reset();
      setMessage('Approval rule created');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create rule failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: ApprovalRule) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/workflow/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setMessage(rule.enabled ? 'Rule disabled' : 'Rule enabled');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update rule failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRule(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/workflow/rules/${id}`, { method: 'DELETE' });
      setMessage('Rule deleted');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete rule failed');
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

      {tab === 'webhooks' && (
        <div className="panel">
          <h2>Outbound webhooks</h2>
          <p className="lede">
            HMAC-signed JSON POSTs for ecosystem events (Phase 3). Secret is
            shown once on create.
          </p>
          {newWebhookSecret && (
            <p className="ok">
              Signing secret (copy now): <code>{newWebhookSecret}</code>
            </p>
          )}
          <ul className="task-list">
            {webhookEndpoints.map((ep) => (
              <li key={ep.id}>
                <div>
                  <strong>{ep.url}</strong>
                  <span className="muted">
                    {' '}
                    · {ep.enabled ? 'on' : 'off'} · {ep.events.join(', ')}
                  </span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        setBusy(true);
                        try {
                          await apiFetch(`/api/webhooks/endpoints/${ep.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ enabled: !ep.enabled }),
                          });
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
                    {ep.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        setBusy(true);
                        try {
                          await apiFetch(`/api/webhooks/endpoints/${ep.id}`, {
                            method: 'DELETE',
                          });
                          await refresh();
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : 'Delete failed',
                          );
                        } finally {
                          setBusy(false);
                        }
                      })()
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {webhookEndpoints.length === 0 && (
              <li className="muted">No endpoints yet.</li>
            )}
          </ul>
          <form
            className="workspace-form"
            onSubmit={(e) =>
              void (async (ev: FormEvent<HTMLFormElement>) => {
                ev.preventDefault();
                const form = ev.currentTarget;
                const data = new FormData(form);
                const selected = webhookEvents.filter(
                  (name) => data.get(`event_${name}`) === 'on',
                );
                setBusy(true);
                setError(null);
                setNewWebhookSecret(null);
                try {
                  const created = await apiFetch<{ secret: string }>(
                    '/api/webhooks/endpoints',
                    {
                      method: 'POST',
                      body: JSON.stringify({
                        url: data.get('url'),
                        description: data.get('description') || undefined,
                        events: selected.length
                          ? selected
                          : ['invoice.approved'],
                      }),
                    },
                  );
                  setNewWebhookSecret(created.secret);
                  form.reset();
                  await refresh();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Create failed',
                  );
                } finally {
                  setBusy(false);
                }
              })(e)
            }
          >
            <label className="span-2">
              URL
              <input name="url" required placeholder="https://example.com/hooks" />
            </label>
            <label className="span-2">
              Description
              <input name="description" placeholder="ERP listener" />
            </label>
            {webhookEvents.map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  name={`event_${name}`}
                  defaultChecked={name === 'invoice.approved'}
                />{' '}
                {name}
              </label>
            ))}
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Add endpoint
              </button>
            </div>
          </form>
          <h3>Recent deliveries</h3>
          <ul className="task-list">
            {webhookDeliveries.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.event}</strong>
                  <span className="muted">
                    {' '}
                    · {d.status}
                    {d.httpStatus != null ? ` · HTTP ${d.httpStatus}` : ''}
                    {' · '}
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                  {d.errorMessage && <p className="error">{d.errorMessage}</p>}
                </div>
              </li>
            ))}
            {webhookDeliveries.length === 0 && (
              <li className="muted">No deliveries yet.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'sso' && (
        <div className="panel">
          <h2>SSO (OIDC)</h2>
          <p className="lede">
            Enable OpenID Connect for this tenant. Use mock mode for local
            tests; live mode needs issuer + client id (Google / Entra).
          </p>
          <p className="muted">
            Redirect URI:{' '}
            <code>http://127.0.0.1:3001/api/auth/oidc/callback</code>
          </p>
          <form
            className="workspace-form"
            onSubmit={(e) =>
              void (async (ev: FormEvent<HTMLFormElement>) => {
                ev.preventDefault();
                const form = ev.currentTarget;
                const data = new FormData(form);
                setBusy(true);
                setError(null);
                setMessage(null);
                try {
                  const secret = String(data.get('clientSecret') || '').trim();
                  const updated = await apiFetch<OidcAdmin>(
                    '/api/auth/providers/oidc',
                    {
                      method: 'PATCH',
                      body: JSON.stringify({
                        enabled: data.get('enabled') === 'on',
                        settings: {
                          mode: data.get('mode') || 'mock',
                          displayName: data.get('displayName') || 'SSO',
                          issuer: data.get('issuer') || undefined,
                          clientId: data.get('clientId') || undefined,
                          scopes: data.get('scopes') || undefined,
                          mockEmail: data.get('mockEmail') || undefined,
                          ...(secret ? { clientSecret: secret } : {}),
                        },
                      }),
                    },
                  );
                  setOidc(updated);
                  setMessage('OIDC settings saved');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Save failed');
                } finally {
                  setBusy(false);
                }
              })(e)
            }
          >
            <label>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={oidc?.enabled ?? false}
              />{' '}
              Enable OIDC
            </label>
            <label>
              Mode
              <select name="mode" defaultValue={oidc?.settings.mode ?? 'mock'}>
                <option value="mock">mock (dev)</option>
                <option value="live">live</option>
              </select>
            </label>
            <label>
              Button label
              <input
                name="displayName"
                defaultValue={oidc?.settings.displayName ?? 'SSO'}
              />
            </label>
            <label>
              Mock email
              <input
                name="mockEmail"
                type="email"
                defaultValue={oidc?.settings.mockEmail ?? ''}
                placeholder="admin@tenant.test"
              />
            </label>
            <label>
              Issuer URL
              <input
                name="issuer"
                defaultValue={oidc?.settings.issuer ?? ''}
                placeholder="https://accounts.google.com"
              />
            </label>
            <label>
              Client ID
              <input
                name="clientId"
                defaultValue={oidc?.settings.clientId ?? ''}
              />
            </label>
            <label>
              Client secret
              <input
                name="clientSecret"
                type="password"
                placeholder={
                  oidc?.clientSecretSet ? '(unchanged)' : 'optional'
                }
              />
            </label>
            <label>
              Scopes
              <input
                name="scopes"
                defaultValue={oidc?.settings.scopes ?? 'openid email profile'}
              />
            </label>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Save OIDC
              </button>
            </div>
          </form>
        </div>
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

      {tab === 'workflow' && (
        <div className="panel">
          <h2>Approvals</h2>
          <p className="lede">
            Invoices at or under this amount auto-approve on submit; above creates
            approval tasks for admin/approver/ap_manager roles.
          </p>
          {!policy && <p className="muted">Loading policy…</p>}
          {policy && (
            <form
              key={policy.id}
              className="workspace-form"
              onSubmit={(e) => void onSavePolicy(e)}
            >
              <label>
                Policy name
                <input name="name" defaultValue={policy.name} required />
              </label>
              <label>
                Auto-approve under (major currency)
                <input
                  name="autoApproveUnderMajor"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={
                    policy.autoApproveUnderMinor != null
                      ? (policy.autoApproveUnderMinor / 100).toFixed(2)
                      : ''
                  }
                  placeholder="e.g. 100.00"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={policy.enabled}
                />{' '}
                Enabled
              </label>
              <div className="span-2 actions">
                <button type="submit" disabled={busy}>
                  Save policy
                </button>
              </div>
            </form>
          )}

          <h3>Amount / entity band rules</h3>
          <p className="muted">
            Rules are evaluated by priority (highest first). First match wins. If
            none match, the default policy threshold applies.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Entity</th>
                  <th>Min–max (major)</th>
                  <th>Auto-approve</th>
                  <th>Assignee role</th>
                  <th>Priority</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalRules.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No band rules yet.
                    </td>
                  </tr>
                )}
                {approvalRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>{entityLabel(rule.entityId)}</td>
                    <td>
                      {formatMajor(rule.minMinor)} – {formatMajor(rule.maxMinor)}
                    </td>
                    <td>{rule.autoApprove ? 'Yes' : 'No'}</td>
                    <td>{rule.assigneeRole ?? 'default roles'}</td>
                    <td>{rule.priority}</td>
                    <td>{rule.enabled ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={busy}
                          onClick={() => void toggleRule(rule)}
                        >
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={busy}
                          onClick={() => void deleteRule(rule.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Create rule</h3>
          <form
            className="workspace-form"
            onSubmit={(e) => void onCreateRule(e)}
          >
            <label>
              Name
              <input name="name" required minLength={1} placeholder="High value" />
            </label>
            <label>
              Entity
              <select name="entityId" defaultValue="">
                <option value="">All entities</option>
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.code} / {ent.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Min amount (major)
              <input name="minMajor" type="number" min={0} step="0.01" />
            </label>
            <label>
              Max amount (major)
              <input name="maxMajor" type="number" min={0} step="0.01" />
            </label>
            <label>
              Assignee role
              <select name="assigneeRole" defaultValue="">
                <option value="">Default roles</option>
                <option value="admin">admin</option>
                <option value="approver">approver</option>
                <option value="ap_manager">ap_manager</option>
                <option value="ap_clerk">ap_clerk</option>
              </select>
            </label>
            <label>
              Priority
              <input
                name="priority"
                type="number"
                defaultValue={100}
                required
              />
            </label>
            <label>
              <input type="checkbox" name="autoApprove" /> Auto-approve
            </label>
            <label>
              <input type="checkbox" name="enabled" defaultChecked /> Enabled
            </label>
            <div className="span-2 actions">
              <button type="submit" disabled={busy}>
                Add rule
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
