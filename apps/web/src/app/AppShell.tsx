import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { clearSession } from '../shared/lib/api';

const links = [
  { to: '/', label: 'My Work' },
  { to: '/directory', label: 'Directory' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/integration', label: 'Integration Center' },
  { to: '/admin', label: 'Admin' },
];

export function AppShell() {
  const navigate = useNavigate();

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
