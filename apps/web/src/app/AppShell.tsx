import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, clearSession, getToken } from '../shared/lib/api';

const links = [
  { to: '/', label: 'My Work' },
  { to: '/directory', label: 'Directory' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/integration', label: 'Integration Center' },
  { to: '/admin', label: 'Admin' },
];

export function AppShell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    async function load() {
      try {
        const rows = await apiFetch<{ id: string }[]>(
          '/api/notifications?unreadOnly=true',
        );
        if (!cancelled) setUnread(rows.length);
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

  function signOut() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="shell">
      <aside className="shell__nav">
        <div className="shell__brand">{PRODUCT_NAME}</div>
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
        <button type="button" className="shell__link shell__link--muted shell__signout" onClick={signOut}>
          Sign out
        </button>
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
