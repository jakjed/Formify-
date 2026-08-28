import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type Notice = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type Props = { collapsed: boolean; unread: number; onChange: () => void };

export function NotificationBell({ collapsed, unread, onChange }: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function load() {
    const rows = await apiFetch<Notice[]>('/api/notifications');
    setItems(rows);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      await load().catch(() => undefined);
    }
  }

  async function markAll() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    await load();
    onChange();
  }

  async function openItem(n: Notice) {
    if (!n.readAt) {
      await apiFetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(
        () => undefined,
      );
      onChange();
    }
    setOpen(false);
    if (n.href) navigate(n.href);
  }

  return (
    <div ref={rootRef} className="notif-bell">
      <button
        type="button"
        className="shell__link shell__search"
        onClick={() => void toggle()}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg
          className="shell__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {!collapsed && <span className="shell__link-label">Inbox</span>}
        {unread > 0 && (
          <span className={collapsed ? 'nav-badge nav-badge--dot' : 'nav-badge'}>
            {collapsed ? '' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-bell__panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell__head">
            <strong>Notifications</strong>
            <button type="button" className="btn btn--ghost" onClick={() => void markAll()}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="muted">You’re caught up.</p>
          ) : (
            <ul className="notif-bell__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={
                      n.readAt
                        ? 'notif-bell__item'
                        : 'notif-bell__item notif-bell__item--unread'
                    }
                    onClick={() => void openItem(n)}
                  >
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <em>{new Date(n.createdAt).toLocaleString()}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
