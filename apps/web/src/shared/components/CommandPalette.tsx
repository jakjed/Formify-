import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

type SearchResult = {
  invoices: {
    id: string;
    invoiceNumber: string | null;
    vendorNameRaw: string | null;
    status: string;
  }[];
  vendors: { id: string; code: string; name: string }[];
  users: { id: string; email: string; displayName: string; role: string }[];
};

const NAV = [
  { label: 'My Work', to: '/' },
  { label: 'Invoices', to: '/invoices' },
  { label: 'Exceptions', to: '/exceptions' },
  { label: 'Dashboard', to: '/ops' },
  { label: 'Directory', to: '/directory' },
  { label: 'Integration Center', to: '/integration' },
  { label: 'Admin', to: '/admin' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return NAV;
    return NAV.filter((n) => n.label.toLowerCase().includes(needle));
  }, [q]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setResults(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const needle = q.trim();
    if (needle.length < 2) {
      setResults(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void apiFetch<SearchResult>(`/api/search?q=${encodeURIComponent(needle)}`)
        .then(setResults)
        .catch((err: Error) => setError(err.message));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [q, open]);

  if (!open) return null;

  function go(to: string) {
    onClose();
    navigate(to);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (navHits[0]) go(navHits[0].to);
  }

  return (
    <div className="palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go to… or search invoices, vendors"
            aria-label="Command search"
          />
        </form>
        {error && <p className="error">{error}</p>}
        <div className="palette__section">
          <p className="muted">Navigate</p>
          <ul>
            {navHits.map((n) => (
              <li key={n.to}>
                <button type="button" onClick={() => go(n.to)}>
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {results && (
          <>
            <div className="palette__section">
              <p className="muted">Invoices</p>
              <ul>
                {results.invoices.length === 0 && <li className="muted">No matches</li>}
                {results.invoices.map((inv) => (
                  <li key={inv.id}>
                    <button type="button" onClick={() => go(`/invoices/${inv.id}`)}>
                      {inv.invoiceNumber ?? 'Untitled'} · {inv.vendorNameRaw ?? '—'} ·{' '}
                      {inv.status}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="palette__section">
              <p className="muted">Vendors</p>
              <ul>
                {results.vendors.length === 0 && <li className="muted">No matches</li>}
                {results.vendors.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => go('/directory')}>
                      {v.code} · {v.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <p className="muted palette__hint">Esc to close · Enter opens first nav hit</p>
      </div>
    </div>
  );
}
