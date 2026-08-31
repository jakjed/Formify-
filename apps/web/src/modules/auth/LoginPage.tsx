import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, setSession } from '../../shared/lib/api';
import { AuthBrand, AuthLegalFooter } from './AuthChrome';

type LoginResponse =
  | { token: string; user: { tenantId: string }; mfaRequired?: false }
  | { mfaRequired: true; mfaToken: string };

type Provider = {
  type: string;
  enabled: boolean;
  settings: { displayName?: string; mode?: string };
};

type Workspace = { tenantId: string; slug: string; name: string };

const SLUG_KEY = 'aptora_workspace_slug';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [slug, setSlug] = useState(() => localStorage.getItem(SLUG_KEY) ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(
    params.get('ssoError'),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<{ allowed: boolean }>('/api/tenants/bootstrap-status')
      .then((s) => setBootstrapOpen(s.allowed))
      .catch(() => setBootstrapOpen(false));
  }, []);

  useEffect(() => {
    const trimmed = slug.trim().toLowerCase();
    if (trimmed.length < 2) {
      setProviders([]);
      setWorkspace(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void apiFetch<Workspace>(
        `/api/auth/workspace?slug=${encodeURIComponent(trimmed)}`,
      )
        .then((ws) => {
          setWorkspace(ws);
          localStorage.setItem(SLUG_KEY, trimmed);
          return apiFetch<Provider[]>(
            `/api/auth/providers?slug=${encodeURIComponent(trimmed)}`,
          );
        })
        .then(setProviders)
        .catch(() => {
          setWorkspace(null);
          setProviders([]);
        });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [slug]);

  const oidc = providers.find((p) => p.type === 'oidc' && p.enabled);
  const saml = providers.find((p) => p.type === 'saml' && p.enabled);
  const localOn =
    providers.find((p) => p.type === 'local')?.enabled !== false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (mfaToken) {
        const data = await apiFetch<Extract<LoginResponse, { token: string }>>(
          '/api/auth/mfa/verify',
          {
            method: 'POST',
            body: JSON.stringify({ mfaToken, code: totpCode }),
          },
        );
        setSession(data.token, data.user.tenantId);
        navigate('/');
        return;
      }
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          email,
          password,
        }),
      });
      if ('mfaRequired' in data && data.mfaRequired) {
        setMfaToken(data.mfaToken);
        return;
      }
      if ('token' in data) {
        setSession(data.token, data.user.tenantId);
        navigate('/');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  function startSso(kind: 'oidc' | 'saml') {
    if (!slug.trim()) {
      setMessage('Enter your workspace slug first');
      return;
    }
    const q = new URLSearchParams({ slug: slug.trim().toLowerCase() });
    window.location.assign(`/api/auth/${kind}/start?${q}`);
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={(e) => void onSubmit(e)}>
        <AuthBrand />
        <p className="lede">Sign in to your workspace.</p>
        {mfaToken ? (
          <label>
            Authenticator code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
              minLength={6}
            />
          </label>
        ) : (
          <>
            <label>
              Workspace
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme"
                autoComplete="organization"
                required
                pattern="[a-zA-Z0-9-]+"
              />
            </label>
            {workspace && (
              <p className="muted">
                {workspace.name}{' '}
                <span className="auth__slug">@{workspace.slug}</span>
              </p>
            )}
            {localOn && (
              <>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    minLength={8}
                  />
                </label>
              </>
            )}
          </>
        )}
        {message && <p className="error">{message}</p>}
        {(localOn || mfaToken) && (
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : mfaToken ? 'Verify' : 'Sign in'}
          </button>
        )}
        {!mfaToken && oidc && (
          <button
            type="button"
            className="secondary-btn"
            disabled={busy || !slug}
            onClick={() => startSso('oidc')}
          >
            Continue with {oidc.settings.displayName ?? 'SSO'}
          </button>
        )}
        {!mfaToken && saml && (
          <button
            type="button"
            className="secondary-btn"
            disabled={busy || !slug}
            onClick={() => startSso('saml')}
          >
            Continue with {saml.settings.displayName ?? 'SAML SSO'}
          </button>
        )}
        <p className="muted">
          {bootstrapOpen ? (
            <>
              Need a workspace? <Link to="/bootstrap">Create one</Link>
              {' · '}
            </>
          ) : (
            <>
              New here? <Link to="/waitlist">Join the waitlist</Link>
              {' · '}
            </>
          )}
          <Link to="/reset">Forgot password</Link>
        </p>
        <AuthLegalFooter />
      </form>
    </div>
  );
}
