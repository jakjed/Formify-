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
import { UserMenu } from '../shared/components/UserMenu';

type ModuleRow = { moduleKey: string; enabled: boolean };
type EntityRow = { id: string; name: string; code: string };
type MeUser = {
  id: string;
  role: string;
  email?: string;
  displayName?: string;
  canAccessDirectory?: boolean;
};

type NavIconId =
  | 'command'
  | 'ops'
  | 'contracts'
  | 'requisitions'
  | 'orders'
  | 'invoices'
  | 'directory'
  | 'integration'
  | 'admin'
  | 'search'
  | 'signout';

type NavItem = {
  to: string;
  label: string;
  icon: NavIconId;
  module: string | null;
  group?: 'command' | 'work' | 'platform';
  requiresDirectory?: boolean;
};

const BASE_LINKS: NavItem[] = [
  {
    to: '/',
    label: 'Command Center',
    icon: 'command',
    module: null,
    group: 'command',
  },
  { to: '/ops', label: 'Operations', icon: 'ops', module: null, group: 'command' },
  {
    to: '/contracts',
    label: 'Contracts',
    icon: 'contracts',
    module: 'contracts',
    group: 'work',
  },
  {
    to: '/purchase-requests',
    label: 'Requisitions',
    icon: 'requisitions',
    module: 'purchase_requests',
    group: 'work',
  },
  {
    to: '/purchase-orders',
    label: 'Orders',
    icon: 'orders',
    module: 'purchase_orders',
    group: 'work',
  },
  {
    to: '/invoices',
    label: 'Invoices',
    icon: 'invoices',
    module: 'invoices',
    group: 'work',
  },
  {
    to: '/directory',
    label: 'Directory',
    icon: 'directory',
    module: null,
    group: 'platform',
    requiresDirectory: true,
  },
  {
    to: '/integration',
    label: 'Integration Center',
    icon: 'integration',
    module: null,
    group: 'platform',
  },
  { to: '/admin', label: 'Admin', icon: 'admin', module: null, group: 'platform' },
];

const GROUP_LABEL: Record<string, string> = {
  command: 'Command',
  work: 'Workspaces',
  platform: 'Platform',
};

function NavIcon({ id }: { id: NavIconId }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'shell__icon',
  };

  switch (id) {
    case 'command':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'ops':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16V10" />
          <path d="M12 16V7" />
          <path d="M16 16v-4" />
        </svg>
      );
    case 'contracts':
      return (
        <svg {...common}>
          <path d="M8 3h7l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M15 3v4h4" />
          <path d="M10 12h6" />
          <path d="M10 16h4" />
        </svg>
      );
    case 'requisitions':
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M4 7h16l-1.2 11.2A2 2 0 0 1 16.81 20H7.19a2 2 0 0 1-1.99-1.8L4 7z" />
          <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        </svg>
      );
    case 'invoices':
      return (
        <svg {...common}>
          <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M15 3v4h4" />
          <path d="M9 13h6" />
          <path d="M9 17h3" />
          <path d="M9 9h2" />
        </svg>
      );
    case 'directory':
      return (
        <svg {...common}>
          <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );
    case 'integration':
      return (
        <svg {...common}>
          <path d="M8 12H4v4a4 4 0 0 0 4 4" />
          <path d="M16 12h4v-4a4 4 0 0 0-4 0" />
          <circle cx="8" cy="12" r="3" />
          <circle cx="16" cy="12" r="3" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case 'signout':
      return (
        <svg {...common}>
          <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
          <path d="M15 12H4" />
          <path d="M7 9l-3 3 3 3" />
        </svg>
      );
    default:
      return null;
  }
}

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
    async function loadEntities() {
      try {
        const ents = await apiFetch<EntityRow[]>('/api/entities');
        if (!cancelled) setEntities(ents);
      } catch {
        /* ignore */
      }
    }
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
    const onEntitiesChanged = () => void loadEntities();
    window.addEventListener('aptora:entities-changed', onEntitiesChanged);
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.removeEventListener('aptora:entities-changed', onEntitiesChanged);
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
              src="/brand/procure-ledger-mark-64.png"
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
          <button
            type="button"
            className="shell__link shell__search"
            onClick={() => setPaletteOpen(true)}
            title="Search (⌘K)"
            aria-label="Search"
          >
            <NavIcon id="search" />
            {!collapsed && <span className="shell__link-label">Search (⌘K)</span>}
          </button>
        </div>

        <nav className="shell__nav-scroll" aria-label="Primary">
          {grouped.map((section) => (
            <div key={section.group} className="shell__nav-section">
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
                  aria-label={link.label}
                  className={({ isActive }) =>
                    isActive ? 'shell__link shell__link--active' : 'shell__link'
                  }
                >
                  <NavIcon id={link.icon} />
                  {!collapsed && (
                    <span className="shell__link-label">{link.label}</span>
                  )}
                  {link.to === '/admin' && unread > 0 ? (
                    <span
                      className={
                        collapsed ? 'nav-badge nav-badge--dot' : 'nav-badge'
                      }
                    >
                      {collapsed ? '' : unread}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="shell__nav-foot">
          <UserMenu collapsed={collapsed} me={me} />
          <button
            type="button"
            className="shell__link shell__link--muted shell__signout"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <NavIcon id="signout" />
            {!collapsed && <span className="shell__link-label">Sign out</span>}
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
