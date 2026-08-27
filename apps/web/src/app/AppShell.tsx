import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, clearSession, getToken } from '../shared/lib/api';
import {
  ENTITY_KEY,
  getSelectedEntityId,
  isNavCollapsed,
  setNavCollapsed,
  setSelectedEntityId,
} from '../shared/lib/entity';
import { CommandPalette } from '../shared/components/CommandPalette';

type ModuleRow = { moduleKey: string; enabled: boolean };
type EntityRow = { id: string; name: string; code: string };
type MeUser = {
  id: string;
  role: string;
  canAccessDirectory?: boolean;
};

type NavItem = {
  to: string;
  label: string;
  module: string | null;
  group?: 'command' | 'work' | 'platform';
  requiresDirectory?: boolean;
};

const BASE_LINKS: NavItem[] = [
  { to: '/', label: 'Command Center', module: null, group: 'command' },
  { to: '/ops', label: 'Operations', module: null, group: 'command' },
  { to: '/contracts', label: 'Contracts', module: 'contracts', group: 'work' },
  {
    to: '/purchase-requests',
    label: 'Requisitions',
    module: 'purchase_requests',
    group: 'work',
  },
  {
    to: '/purchase-orders',
    label: 'Orders',
    module: 'purchase_orders',
    group: 'work',
  },
  { to: '/invoices', label: 'Invoices', module: 'invoices', group: 'work' },
  {
    to: '/directory',
    label: 'Directory',
    module: null,
    group: 'platform',
    requiresDirectory: true,
  },
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
  const [me, setMe] = useState<MeUser | null>(null);
  const [entityId, setEntityId] = useState(() => getSelectedEntityId());
  const [collapsed, setCollapsed] = useState(() => isNavCollapsed());

  const enabled = useMemo(() => {
    const map = new Map(modules.map((m) => [m.moduleKey, m.enabled]));
    if (!map.has('invoices')) map.set('invoices', true);
    return map;
  }, [modules]);

  const canDirectory =
    me?.role === 'admin' || me?.canAccessDirectory === true;

  const links = BASE_LINKS.filter((link) => {
    if (link.module && enabled.get(link.module) !== true) return false;
    if (link.requiresDirectory && !canDirectory) return false;
    return true;
  });

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
        const [rows, ents, mods, user] = await Promise.all([
          apiFetch<{ id: string }[]>('/api/notifications?unreadOnly=true'),
          apiFetch<EntityRow[]>('/api/entities').catch(() => [] as EntityRow[]),
          apiFetch<ModuleRow[]>('/api/modules').catch(() => [] as ModuleRow[]),
          apiFetch<MeUser>('/api/auth/me').catch(() => null),
        ]);
        if (cancelled) return;
        setUnread(rows.length);
        setEntities(ents);
        setModules(mods);
        setMe(user);
        const stored = sessionStorage.getItem(ENTITY_KEY);
        if (!stored) {
          setSelectedEntityId('all');
          setEntityId('all');
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
    setSelectedEntityId(id);
    window.dispatchEvent(new CustomEvent('aptora:entity-change', { detail: id }));
  }

  function toggleNav() {
    const next = !collapsed;
    setCollapsed(next);
    setNavCollapsed(next);
  }

  return (
    <div className={collapsed ? 'shell shell--nav-collapsed' : 'shell'}>
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
            {!collapsed && <span>{PRODUCT_NAME}</span>}
          </div>
          <button
            type="button"
            className="shell__collapse-btn"
            onClick={toggleNav}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '»' : '«'}
          </button>
          {!collapsed && entities.length > 0 && (
            <label className="shell__entity">
              Entity
              <select
                value={entityId}
                onChange={(e) => onEntityChange(e.target.value)}
              >
                <option value="all">All</option>
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.code} — {ent.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!collapsed && (
            <button
              type="button"
              className="shell__link shell__link--muted"
              onClick={() => setPaletteOpen(true)}
            >
              Search (⌘K)
            </button>
          )}
        </div>

        <nav className="shell__nav-scroll" aria-label="Primary">
          {grouped.map((section) => (
            <div key={section.group}>
              {!collapsed && (
                <div className="shell__nav-group">
                  {GROUP_LABEL[section.group]}
                </div>
              )}
              {section.items.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  title={link.label}
                  className={({ isActive }) =>
                    isActive ? 'shell__link shell__link--active' : 'shell__link'
                  }
                >
                  {collapsed ? link.label.slice(0, 1) : link.label}
                  {!collapsed && link.to === '/admin' && unread > 0 ? (
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
            {collapsed ? '⎋' : 'Sign out'}
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
