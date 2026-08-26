import { NavLink, Outlet } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';

const links = [
  { to: '/', label: 'My Work' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/integration', label: 'Integration Center' },
  { to: '/admin', label: 'Admin' },
];

export function AppShell() {
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
        <NavLink to="/login" className="shell__link shell__link--muted">
          Sign in
        </NavLink>
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
