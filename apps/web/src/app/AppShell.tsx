import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, clearSession, getToken } from '../shared/lib/api';
import { CommandPalette } from '../shared/components/CommandPalette';

type ModuleRow = { moduleKey: string; enabled: boolean };
type EntityRow = { id: string; name: string; code: string };

const ENTITY_KEY = 'aptora_entity_id';

type NavItem = {
  to: string;
  label: string;
  module: string | null;
  group?: 'command' | 'work' | 'platform';
};

const BASE_LINKS: NavItem[] = [
  { to: '/', label: 'Command Center', module: null, group: 'command' },
  { to: '/ops', label: 'Operations', module: null, group: 'command' },
  { to: '/invoices', label: 'Invoices', module: 'invoices', group: 'work' },
  { to: '/exceptions', label: 'Exceptions', module: 'invoices', group: 'work' },
  { to: '/contracts', label: 'Contracts', module: 'contracts', group: 'work' },
  {
    to: '/purchase-requests',
    label: 'Requests',
    module: 'purchase_requests',
    group: 'work',
  },
  {
    to: '/purchase-orders',
    label: 'Orders',
    module: 'purchase_orders',
    group: 'work',
  },
  { to: '/directory', label: 'Directory', module: null, group: 'platform' },
  {
    to: '/integration',
    label: 'Integration Center',
    module: null,
    group: 'platform',
  },
  { to: '/admin', label: 'Admin', module: null, group: 'platform' },
];

const GROUP_LABEL: Record<string, string> = {
  command: 'Command',
  work: 'Workspaces',
  platform: 'Platform',
};

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
    if (!map.has('invoices')) map.set('invoices', true);
    return map;
  }, [modules]);

  const links = BASE_LINKS.filter(
    (link) => !link.module || enabled.get(link.module) === true,
  );

  const grouped = useMemo(() => {
    const order: Array<NavItem['group']> = ['command', 'work', 'platform'];
    return order
      .map((group) => ({
        group: group!,
        items: links.filter((l) => l.group === group),
      }))
      .filter((g) => g.items.length > 0);
  }, [links]);

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
        <div className="shell__nav-top">
          <div className="shell__brand">
            <img
              className="shell__brand-mark"
              src="/brand/aptora-mark-64.png"
              width={36}
              height={36}
              alt=""
            />
            <span>{PRODUCT_NAME}</span>
          </div>
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
        </div>

        <nav className="shell__nav-scroll" aria-label="Primary">
          {grouped.map((section) => (
            <div key={section.group}>
              <div className="shell__nav-group">{GROUP_LABEL[section.group]}</div>
              {section.items.map((link) => (
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
            </div>
          ))}
        </nav>

        <div className="shell__nav-foot">
          <button
            type="button"
            className="shell__link shell__link--muted shell__signout"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
