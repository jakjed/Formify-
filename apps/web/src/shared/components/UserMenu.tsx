import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type AppTheme,
  THEME_OPTIONS,
  getTheme,
  setTheme,
} from '../lib/theme';

type MeUser = {
  displayName?: string;
  email?: string;
};

type Props = {
  collapsed: boolean;
  me: MeUser | null;
};

export function UserMenu({ collapsed, me }: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [theme, setThemeState] = useState<AppTheme>(() => getTheme());

  const label = me?.displayName?.trim() || me?.email?.split('@')[0] || 'Account';

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPrefsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setPrefsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function pickTheme(next: AppTheme) {
    setTheme(next);
    setThemeState(next);
  }

  return (
    <div
      ref={rootRef}
      className={collapsed ? 'user-menu user-menu--collapsed' : 'user-menu'}
    >
      <button
        type="button"
        className="shell__link shell__link--muted user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="shell__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
        {!collapsed && (
          <>
            <span className="shell__link-label user-menu__label">{label}</span>
            <span className="user-menu__chevron" aria-hidden>
              {open ? '▴' : '▾'}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="user-menu__panel" role="menu">
          {!collapsed && me?.email && (
            <div className="user-menu__meta">
              <span className="user-menu__name">{label}</span>
              <span className="user-menu__email">{me.email}</span>
            </div>
          )}

          <button
            type="button"
            className="user-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/account/delegation');
            }}
          >
            Delegations
          </button>
          <button
            type="button"
            className="user-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/account/security');
            }}
          >
            Security
          </button>

          <div className="user-menu__section">
            <button
              type="button"
              className="user-menu__item user-menu__item--toggle"
              aria-expanded={prefsOpen}
              onClick={() => setPrefsOpen((v) => !v)}
            >
              Preferences
              <span className="user-menu__chevron" aria-hidden>
                {prefsOpen ? '▴' : '▾'}
              </span>
            </button>
            {prefsOpen && (
              <div className="user-menu__sub">
                <p className="user-menu__sub-label">Theme</p>
                {THEME_OPTIONS.map((opt) => (
                  <label key={opt.id} className="user-menu__theme">
                    <input
                      type="radio"
                      name="pl-theme"
                      checked={theme === opt.id}
                      onChange={() => pickTheme(opt.id)}
                    />
                    <span>
                      <strong>{opt.label}</strong>
                      <span className="user-menu__theme-hint">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
