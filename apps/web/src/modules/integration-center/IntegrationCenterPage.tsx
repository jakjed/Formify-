import { useEffect, useState } from 'react';
import { apiFetch, getToken } from '../../shared/lib/api';

type Template = {
  key: string;
  name: string;
  direction: string;
  format: string;
  headers: string[];
  note?: string;
};

type Job = {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  rowCount: number;
  createdAt: string;
};

export function IntegrationCenterPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [t, j] = await Promise.all([
      apiFetch<Template[]>('/api/integration/templates'),
      apiFetch<Job[]>('/api/integration/jobs'),
    ]);
    setTemplates(t);
    setJobs(j);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function exportApproved() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const token = getToken();
      const res = await fetch('/api/integration/exports/approved-invoices', {
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
        'approved-invoices.csv';
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

  return (
    <section className="page">
      <h1>Integration Center</h1>
      <p className="lede">Templates and export jobs — connectors come later.</p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

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
              {t.note && <div className="muted">{t.note}</div>}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => void exportApproved()} disabled={busy}>
          {busy ? 'Exporting…' : 'Export approved invoices'}
        </button>
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
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5}>No jobs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
