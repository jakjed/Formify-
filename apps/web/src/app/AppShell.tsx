import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, clearSession, getToken } from '../shared/lib/api';
import { CommandPalette } from '../shared/components/CommandPalette';

type ModuleRow = { moduleKey: string; enabled: boolean };
type EntityRow = { id: string; name: string; code: string };

const ENTITY_KEY = 'aptora_entity_id';

const BASE_LINKS = [
  { to: '/', label: 'My Work', module: null as string | null },
  { to: '/invoices', label: 'Invoices', module: 'invoices' },
  { to: '/exceptions', label: 'Exceptions', module: 'invoices' },
  { to: '/ops', label: 'Dashboard', module: 'invoices' },
  { to: '/contracts', label: 'Contracts', module: 'contracts' },
  { to: '/purchase-requests', label: 'Requests', module: 'purchase_requests' },
  { to: '/purchase-orders', label: 'Orders', module: 'purchase_orders' },
  { to: '/directory', label: 'Directory', module: null },
  { to: '/integration', label: 'Integration Center', module: null },
  { to: '/admin', label: 'Admin', module: null },
];

export function AppShell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [entityId, setEntityId] = useState(
    () => sessionStorage.getItem(ENTITY_KEY) ?? '',
  );

  const enabled = useMemo(() => {
    const map = new Map(modules.map((m) => [m.moduleKey, m.enabled]));
    // Default invoices on if license row missing (legacy tenants)
    if (!map.has('invoices')) map.set('invoices', true);
    return map;
  }, [modules]);

  const links = BASE_LINKS.filter(
    (link) => !link.module || enabled.get(link.module) === true,
  );

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    async function load() {
      try {
        const [rows, ents, mods] = await Promise.all([
          apiFetch<{ id: string }[]>('/api/notifications?unreadOnly=true'),
          apiFetch<EntityRow[]>('/api/entities').catch(() => [] as EntityRow[]),
          apiFetch<ModuleRow[]>('/api/modules').catch(() => [] as ModuleRow[]),
        ]);
        if (cancelled) return;
        setUnread(rows.length);
        setEntities(ents);
        setModules(mods);
        if (!sessionStorage.getItem(ENTITY_KEY) && ents[0]) {
          sessionStorage.setItem(ENTITY_KEY, ents[0].id);
          setEntityId(ents[0].id);
        }
      } catch {
        /* ignore while bootstrapping */
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function signOut() {
    clearSession();
    navigate('/login');
  }

  function onEntityChange(id: string) {
    setEntityId(id);
    sessionStorage.setItem(ENTITY_KEY, id);
  }

  return (
    <div className="shell">
      <aside className="shell__nav">
        <div className="shell__brand">{PRODUCT_NAME}</div>
        {entities.length > 0 && (
          <label className="shell__entity">
            Entity
            <select
              value={entityId}
              onChange={(e) => onEntityChange(e.target.value)}
            >
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.code} — {ent.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="shell__link shell__link--muted"
          onClick={() => setPaletteOpen(true)}
        >
          Search (⌘K)
        </button>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                isActive ? 'shell__link shell__link--active' : 'shell__link'
              }
            >
              {link.label}
              {link.to === '/admin' && unread > 0 ? (
                <span className="nav-badge">{unread}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="shell__link shell__link--muted shell__signout"
          onClick={signOut}
        >
          Sign out
        </button>
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
