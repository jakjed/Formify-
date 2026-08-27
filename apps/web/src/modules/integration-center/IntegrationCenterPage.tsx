import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, getToken } from '../../shared/lib/api';

type Template = {
  key: string;
  name: string;
  direction: string;
  format: string;
  headers: string[];
  module?: string;
  note?: string;
};

type Job = {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  rowCount: number;
  errorMessage: string | null;
  createdAt: string;
};

type ModuleRow = { moduleKey: string; enabled: boolean };

type ConnectorPack = {
  key: string;
  name: string;
  status: string;
  description: string;
};

type ConnectorConnection = {
  id: string;
  packKey: string;
  status: string;
  settings: Record<string, unknown>;
  connectedAt: string | null;
  hasCredentials: boolean;
};

export function IntegrationCenterPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [packs, setPacks] = useState<ConnectorPack[]>([]);
  const [connections, setConnections] = useState<ConnectorConnection[]>([]);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function moduleOn(key: string) {
    return modules.some((m) => m.moduleKey === key && m.enabled);
  }

  function connectionFor(packKey: string) {
    return connections.find((c) => c.packKey === packKey) ?? null;
  }

  async function refresh() {
    const [t, j, m, p, c] = await Promise.all([
      apiFetch<Template[]>('/api/integration/templates'),
      apiFetch<Job[]>('/api/integration/jobs'),
      apiFetch<ModuleRow[]>('/api/modules').catch(() => [] as ModuleRow[]),
      apiFetch<ConnectorPack[]>('/api/integration/connector-packs').catch(
        () => [] as ConnectorPack[],
      ),
      apiFetch<ConnectorConnection[]>('/api/integration/connections').catch(
        () => [] as ConnectorConnection[],
      ),
    ]);
    setTemplates(t);
    setJobs(j);
    setModules(m);
    setPacks(p);
    setConnections(c);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function downloadTemplate(key: string, fileName: string) {
    const token = getToken();
    const res = await fetch(`/api/integration/templates/${key}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Template download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportApproved() {
    await runExport('/api/integration/exports/approved-invoices', 'approved-invoices.csv');
  }

  async function runExport(path: string, fallbackName: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const token = getToken();
      const res = await fetch(path, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ??
        fallbackName;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${res.headers.get('X-Aptora-Row-Count') ?? '?'} rows`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function onImport(
    e: FormEvent<HTMLFormElement>,
    endpoint: 'vendors' | 'gl-accounts',
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const token = getToken();
      const res = await fetch(`/api/integration/imports/${endpoint}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      const data = (await res.json()) as {
        message?: string;
        upserted?: number;
        errors?: string[];
        job?: { status: string };
      };
      if (!res.ok) throw new Error(data.message ?? `Import failed (${res.status})`);
      setMessage(
        `Imported ${data.upserted ?? 0} rows` +
          (data.errors?.length ? ` (${data.errors.length} row warnings)` : ''),
      );
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  async function connectDemoErp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDemoToken(null);
    try {
      const res = await apiFetch<{ accessToken: string }>(
        '/api/integration/connections/demo-erp/connect',
        { method: 'POST' },
      );
      setDemoToken(res.accessToken);
      setMessage('Demo ERP connected — copy access token now');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  }

  async function disconnectDemoErp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/integration/connections/demo-erp/disconnect', {
        method: 'POST',
      });
      setDemoToken(null);
      setMessage('Demo ERP disconnected');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setBusy(false);
    }
  }

  async function syncDemoErp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ message: string; rowCount: number }>(
        '/api/integration/connections/demo-erp/sync',
        { method: 'POST' },
      );
      setMessage(res.message ?? `Synced ${res.rowCount} rows`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <h1>Integration Center</h1>
      <p className="lede">
        Templates, CSV import/export, and connector runtime — Demo ERP is
        available now; other packs remain planned.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="panel">
        <h2>Connector packs</h2>
        <p className="muted">
          Connect Demo ERP with mock credentials, then run a stub sync of
          approved invoices. Live NetSuite/QBO OAuth comes later.
        </p>
        {demoToken && (
          <p className="ok">
            Demo access token (copy once): <code>{demoToken}</code>
          </p>
        )}
        <ul className="task-list">
          {packs.map((pack) => {
            const conn = connectionFor(pack.key);
            const isDemo = pack.key === 'demo-erp';
            const connected = conn?.status === 'connected';
            return (
              <li key={pack.key}>
                <div>
                  <strong>{pack.name}</strong>
                  <span className="muted">
                    {' '}
                    · {pack.status}
                    {isDemo && conn
                      ? ` · ${conn.status}`
                      : isDemo
                        ? ' · not connected'
                        : ''}
                  </span>
                  <p className="muted">{pack.description}</p>
                </div>
                {isDemo && pack.status === 'available' && (
                  <div className="actions">
                    {!connected ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void connectDemoErp()}
                      >
                        Connect
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void syncDemoErp()}
                        >
                          Run sync
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={busy}
                          onClick={() => void disconnectDemoErp()}
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {packs.length === 0 && <li className="muted">No packs listed.</li>}
        </ul>
      </div>

      <div className="panel">
        <h2>Templates</h2>
        <ul>
          {templates.map((t) => (
            <li key={t.key}>
              <strong>{t.name}</strong> ({t.direction}/{t.format})
              {' · '}
              <button
                type="button"
                className="linkish"
                onClick={() =>
                  void downloadTemplate(t.key, `${t.key}.csv`).catch((err: Error) =>
                    setError(err.message),
                  )
                }
              >
                Download blank CSV
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Import vendors</h2>
        <form className="inline-form" onSubmit={(e) => void onImport(e, 'vendors')}>
          <input name="file" type="file" accept=".csv,text/csv" required />
          <button type="submit" disabled={busy}>
            Upload vendors CSV
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Import GL accounts</h2>
        <form className="inline-form" onSubmit={(e) => void onImport(e, 'gl-accounts')}>
          <input name="file" type="file" accept=".csv,text/csv" required />
          <button type="submit" disabled={busy}>
            Upload GL CSV
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Export</h2>
        <div className="actions">
          <button type="button" onClick={() => void exportApproved()} disabled={busy}>
            {busy ? 'Working…' : 'Export approved invoices'}
          </button>
          {moduleOn('contracts') && (
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={() =>
                void runExport('/api/integration/exports/contracts', 'contracts.csv')
              }
            >
              Export contracts
            </button>
          )}
          {moduleOn('purchase_requests') && (
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={() =>
                void runExport(
                  '/api/integration/exports/purchase-requests',
                  'purchase-requests.csv',
                )
              }
            >
              Export purchase requests
            </button>
          )}
          {moduleOn('purchase_orders') && (
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={() =>
                void runExport(
                  '/api/integration/exports/purchase-orders',
                  'purchase-orders.csv',
                )
              }
            >
              Export purchase orders
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Recent jobs</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Status</th>
                <th>File</th>
                <th>Rows</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>{job.type}</td>
                  <td>{job.status}</td>
                  <td>{job.fileName ?? '—'}</td>
                  <td>{job.rowCount}</td>
                  <td>{job.errorMessage ?? '—'}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6}>No jobs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
