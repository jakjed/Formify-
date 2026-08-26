import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type InvoiceListItem = {
  id: string;
  status: string;
  invoiceNumber: string | null;
  vendorNameRaw: string | null;
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
    id: 'approved',
    label: 'Approved (export)',
    status: 'approved',
    q: '',
    hasOpenExceptions: false,
    sort: 'created_desc',
  },
];

const VIEWS_KEY = 'aptora_invoice_views';

function formatMoney(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

function loadCustomViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customViews, setCustomViews] = useState<SavedView[]>(loadCustomViews);

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
    if (status) sp.set('status', status);
    if (q.trim()) sp.set('q', q.trim());
    if (hasOpenExceptions) sp.set('hasOpenExceptions', 'true');
    if (sort) sp.set('sort', sort);
    const qs = sp.toString();
    setItems(await apiFetch<InvoiceListItem[]>(`/api/invoices${qs ? `?${qs}` : ''}`));
  }, [status, q, hasOpenExceptions, sort]);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
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

  function saveCurrentView() {
    const label = window.prompt('Name this view');
    if (!label?.trim()) return;
    const view: SavedView = {
      id: `custom-${Date.now()}`,
      label: label.trim(),
      status,
      q,
      hasOpenExceptions,
      sort,
    };
    const next = [...customViews, view];
    setCustomViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    applyView(view);
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const token = sessionStorage.getItem('aptora_token');
      const res = await fetch('/api/capture/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message ?? `Upload failed (${res.status})`);
      }
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <h1>Invoices</h1>
      <p className="lede">
        Worklist with filters and saved views. Upload, review, approve.
      </p>

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
        <button type="button" className="view-chip" onClick={saveCurrentView}>
          Save view
        </button>
      </div>

      <form className="inline-form" onSubmit={onUpload}>
        <input
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          required
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload & extract'}
        </button>
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
      </form>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Status</th>
              <th>Exceptions</th>
              <th>Age</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inv) => {
              const ageHours = Math.max(
                0,
                (Date.now() - new Date(inv.createdAt).getTime()) /
                  (1000 * 60 * 60),
              );
              return (
                <tr key={inv.id}>
                  <td>
                    <Link to={`/invoices/${inv.id}`}>
                      {inv.invoiceNumber ?? 'Draft'}
                    </Link>
                  </td>
                  <td>{inv.vendorNameRaw ?? '—'}</td>
                  <td>{formatMoney(inv.totalMinor, inv.currency)}</td>
                  <td>
                    <span className="status-chip">{inv.status}</span>
                  </td>
                  <td>
                    {inv.exceptions.map((x) => x.code).join(', ') || '—'}
                  </td>
                  <td className="muted">
                    {ageHours < 24
                      ? `${Math.round(ageHours)}h`
                      : `${Math.round(ageHours / 24)}d`}
                  </td>
                  <td>{inv.fileAsset?.originalName ?? '—'}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  No invoices match — upload a file or clear filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
