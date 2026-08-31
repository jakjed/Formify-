import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, getToken } from '../../shared/lib/api';
import { appendEntityParam, formatEntityCell } from '../../shared/lib/entity';
import { FileSelect } from '../../shared/components/FileSelect';
import { InvoiceStatusBadge } from '../../shared/ui/StatusBadge';
import { ageTone } from '../../shared/ui/status';

type InvoiceListItem = {
  id: string;
  status: string;
  invoiceNumber: string | null;
  vendorNameRaw: string | null;
  entityId: string | null;
  currency: string;
  totalMinor: number | null;
  createdAt: string;
  exceptions: { code: string }[];
  fileAsset: { originalName: string } | null;
};

type SavedView = {
  id: string;
  label: string;
  status: string;
  q: string;
  hasOpenExceptions: boolean;
  sort: string;
};

const BUILTIN_VIEWS: SavedView[] = [
  {
    id: 'all',
    label: 'All',
    status: '',
    q: '',
    hasOpenExceptions: false,
    sort: 'created_desc',
  },
  {
    id: 'review',
    label: 'Needs review',
    status: 'needs_review',
    q: '',
    hasOpenExceptions: false,
    sort: 'created_desc',
  },
  {
    id: 'exceptions',
    label: 'Open exceptions',
    status: '',
    q: '',
    hasOpenExceptions: true,
    sort: 'age_desc',
  },
  {
    id: 'approval',
    label: 'In approval',
    status: 'in_approval',
    q: '',
    hasOpenExceptions: false,
    sort: 'created_desc',
  },
  {
    id: 'high',
    label: 'High amount',
    status: '',
    q: '',
    hasOpenExceptions: false,
    sort: 'total_desc',
  },
  {
    id: 'approved',
    label: 'Approved (export)',
    status: 'approved',
    q: '',
    hasOpenExceptions: false,
    sort: 'created_desc',
  },
];

function formatMoney(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customViews, setCustomViews] = useState<SavedView[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [inbox, setInbox] = useState<{
    extracting: { id: string; status: string; fileAsset: { originalName: string } | null }[];
  } | null>(null);

  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const hasOpenExceptions = params.get('hasOpenExceptions') === 'true';
  const sort = params.get('sort') ?? 'created_desc';
  const viewId = params.get('view') ?? '';

  const allViews = useMemo(
    () => [...BUILTIN_VIEWS, ...customViews],
    [customViews],
  );

  const refresh = useCallback(async () => {
    setError(null);
    const sp = new URLSearchParams();
    appendEntityParam(sp);
    if (status) sp.set('status', status);
    if (q.trim()) sp.set('q', q.trim());
    if (hasOpenExceptions) sp.set('hasOpenExceptions', 'true');
    if (sort) sp.set('sort', sort);
    setItems(await apiFetch<InvoiceListItem[]>(`/api/invoices?${sp}`));
    const views = await apiFetch<
      { id: string; name: string; filters: { status?: string; q?: string; hasOpenExceptions?: boolean; sort?: string } }[]
    >('/api/invoices/views').catch(() => []);
    setCustomViews(
      views.map((v) => ({
        id: v.id,
        label: v.name,
        status: v.filters.status ?? '',
        q: v.filters.q ?? '',
        hasOpenExceptions: Boolean(v.filters.hasOpenExceptions),
        sort: v.filters.sort ?? 'created_desc',
      })),
    );
    const cap = await apiFetch<{
      extracting: { id: string; status: string; fileAsset: { originalName: string } | null }[];
    }>('/api/invoices/capture-inbox').catch(() => null);
    setInbox(cap);
  }, [status, q, hasOpenExceptions, sort]);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, [refresh]);

  useEffect(() => {
    const onEntityChange = () => {
      void refresh().catch((err: Error) => setError(err.message));
    };
    window.addEventListener('aptora:entity-change', onEntityChange);
    return () => window.removeEventListener('aptora:entity-change', onEntityChange);
  }, [refresh]);

  function applyView(view: SavedView) {
    const next = new URLSearchParams();
    next.set('view', view.id);
    if (view.status) next.set('status', view.status);
    if (view.q) next.set('q', view.q);
    if (view.hasOpenExceptions) next.set('hasOpenExceptions', 'true');
    if (view.sort) next.set('sort', view.sort);
    setParams(next);
  }

  function updateFilter(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    next.delete('view');
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  }

  async function saveCurrentView() {
    const label = window.prompt('Name this view');
    if (!label?.trim()) return;
    try {
      const created = await apiFetch<{ id: string; name: string }>(
        '/api/invoices/views',
        {
          method: 'POST',
          body: JSON.stringify({
            name: label.trim(),
            filters: { status, q, hasOpenExceptions, sort },
            shared: true,
          }),
        },
      );
      const view: SavedView = {
        id: created.id,
        label: created.name,
        status,
        q,
        hasOpenExceptions,
        sort,
      };
      setCustomViews((prev) => [...prev, view]);
      applyView(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save view');
    }
  }

  async function bulk(action: 'submit' | 'export') {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const result = await apiFetch<{
        csv?: string;
        results?: { ok: boolean }[];
      }>('/api/invoices/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: selected, action }),
      });
      if (action === 'export' && result.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'invoices-selection.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
      setSelected([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    try {
      const token = getToken();
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/capture/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          failures.push(
            `${file.name}: ${data.message ?? `failed (${res.status})`}`,
          );
        }
      }
      await refresh();
      if (failures.length > 0) {
        setError(
          failures.length === files.length
            ? failures.join('; ')
            : `Uploaded with errors — ${failures.join('; ')}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;
    await uploadFiles(files);
    form.reset();
  }

  function onDropZoneDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  async function onDropZoneDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer.files
      ? Array.from(e.dataTransfer.files)
      : [];
    if (files.length === 0) return;
    await uploadFiles(files);
  }

  async function exportCsv() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      appendEntityParam(params);
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      if (hasOpenExceptions) params.set('hasOpenExceptions', 'true');
      if (sort) params.set('sort', sort);
      const token = getToken();
      const res = await fetch(`/api/invoices/export.csv?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page page--worklist">
      <header className="cockpit-hero">
        <div>
          <p className="eyebrow">Capture & review</p>
          <h1>Invoices</h1>
          <p className="lede">
            Filter the queue, open a document, clear exceptions, approve.
          </p>
        </div>
      </header>

      <div className="view-chips">
        {allViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className={
              viewId === view.id || (!viewId && view.id === 'all')
                ? 'view-chip view-chip--active'
                : 'view-chip'
            }
            onClick={() => applyView(view)}
          >
            {view.label}
          </button>
        ))}
        <button type="button" className="view-chip" onClick={() => void saveCurrentView()}>
          Save view
        </button>
      </div>

      {inbox && inbox.extracting.length > 0 && (
        <div className="panel panel--wide capture-inbox">
          <h2>Capture inbox</h2>
          <ul>
            {inbox.extracting.map((row) => (
              <li key={row.id}>
                <Link to={`/invoices/${row.id}`}>
                  {row.fileAsset?.originalName ?? row.id.slice(0, 8)}
                </Link>{' '}
                <InvoiceStatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="dropzone"
        onSubmit={onUpload}
        onDragOver={onDropZoneDragOver}
        onDrop={(e) => void onDropZoneDrop(e)}
      >
        <p className="dropzone__title">Upload invoice</p>
        <p className="dropzone__hint">
          Drag and drop one or more PDF, PNG, JPG, or TXT files — or choose
          multiple files. Each file becomes its own invoice for OCR review.
        </p>
        <div className="inline-form" style={{ margin: 0 }}>
          <FileSelect
            name="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            multiple
            required
          />
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Uploading…' : 'Upload & extract'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </button>
        </div>
      </form>

      <form
        className="inline-form worklist-toolbar"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="search"
          placeholder="Search number, vendor, file…"
          value={q}
          onChange={(e) => updateFilter({ q: e.target.value })}
          aria-label="Search invoices"
        />
        <select
          value={status}
          onChange={(e) => updateFilter({ status: e.target.value })}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="needs_review">Needs review</option>
          <option value="exception">Exception</option>
          <option value="in_approval">In approval</option>
          <option value="approved">Approved</option>
          <option value="exported">Exported</option>
          <option value="void">Void</option>
        </select>
        <select
          value={sort}
          onChange={(e) => updateFilter({ sort: e.target.value })}
          aria-label="Sort"
        >
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="age_desc">Oldest first (aging)</option>
          <option value="total_desc">Total high → low</option>
          <option value="total_asc">Total low → high</option>
        </select>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={hasOpenExceptions}
            onChange={(e) =>
              updateFilter({
                hasOpenExceptions: e.target.checked ? 'true' : null,
              })
            }
          />
          Open exceptions only
        </label>
        {selected.length > 0 && (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void bulk('submit')}
            >
              Submit {selected.length}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void bulk('export')}
            >
              Export selected
            </button>
          </>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={items.length > 0 && selected.length === items.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? items.map((i) => i.id) : [])
                  }
                />
              </th>
              <th>Number</th>
              <th>Entity</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Status</th>
              <th>Exceptions</th>
              <th>Age</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                    <div className="empty-state__orb" aria-hidden />
                    <h3>No invoices in this view</h3>
                    <p className="muted">Upload a document or clear filters.</p>
                  </div>
                </td>
              </tr>
            )}
            {items.map((inv) => {
              const ageHours = Math.max(
                0,
                (Date.now() - new Date(inv.createdAt).getTime()) /
                  (1000 * 60 * 60),
              );
              const aging = ageTone(ageHours);
              return (
                <tr key={inv.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(inv.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, inv.id]
                            : prev.filter((id) => id !== inv.id),
                        )
                      }
                      aria-label={`Select ${inv.invoiceNumber ?? 'draft'}`}
                    />
                  </td>
                  <td>
                    <Link to={`/invoices/${inv.id}`}>
                      {inv.invoiceNumber ?? 'Draft'}
                    </Link>
                  </td>
                  <td className="muted">{formatEntityCell(inv.entityId)}</td>
                  <td>{inv.vendorNameRaw ?? '—'}</td>
                  <td>{formatMoney(inv.totalMinor, inv.currency)}</td>
                  <td>
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td>
                    {inv.exceptions.length > 0 ? (
                      <span className="status-badge status-badge--danger">
                        <span className="status-badge__dot" aria-hidden />
                        {inv.exceptions.map((x) => x.code).join(', ')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`age-cell--${aging}`}>
                    {ageHours < 24
                      ? `${Math.round(ageHours)}h`
                      : `${Math.round(ageHours / 24)}d`}
                  </td>
                  <td className="muted">
                    {inv.fileAsset?.originalName ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
