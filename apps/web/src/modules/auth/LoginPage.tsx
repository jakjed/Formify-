import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, setSession } from '../../shared/lib/api';

type LoginResponse = {
  token: string;
  user: { tenantId: string; email: string; displayName: string };
};

type Provider = {
  type: string;
  enabled: boolean;
  settings: { displayName?: string; mode?: string };
};

/** Local dev default — Acme tenant (matches admin@acme.test seed). */
const DEV_ACME_TENANT_ID = '686c8950-4c24-4a8b-961e-b69c18e97c32';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tenantId, setTenantId] = useState(DEV_ACME_TENANT_ID);
  const [email, setEmail] = useState('admin@acme.test');
  const [password, setPassword] = useState('password1');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [message, setMessage] = useState<string | null>(
    params.get('ssoError'),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenantId || tenantId.length < 32) {
      setProviders([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void apiFetch<Provider[]>(
        `/api/auth/providers?tenantId=${encodeURIComponent(tenantId)}`,
      )
        .then(setProviders)
        .catch(() => setProviders([]));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [tenantId]);

  const oidc = providers.find((p) => p.type === 'oidc' && p.enabled);
  const saml = providers.find((p) => p.type === 'saml' && p.enabled);
  const localOn =
    providers.find((p) => p.type === 'local')?.enabled !== false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ tenantId, email, password }),
      });
      setSession(data.token, data.user.tenantId);
      navigate('/');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  function startOidc() {
    if (!tenantId) {
      setMessage('Enter tenant ID first');
      return;
    }
    const q = new URLSearchParams({ tenantId });
    if (oidc?.settings?.mode === 'mock' && email) {
      q.set('email', email);
    }
    window.location.assign(`/api/auth/oidc/start?${q}`);
  }

  function startSaml() {
    if (!tenantId) {
      setMessage('Enter tenant ID first');
      return;
    }
    const q = new URLSearchParams({ tenantId });
    if (saml?.settings?.mode === 'mock' && email) {
      q.set('email', email);
    }
    window.location.assign(`/api/auth/saml/start?${q}`);
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={onSubmit}>
        <div className="auth__brand">
          <img
            className="auth__mark"
            src="/brand/procure-ledger-mark.png"
            width={72}
            height={72}
            alt=""
          />
          <h1>{PRODUCT_NAME}</h1>
        </div>
        <p className="lede">Sign in with local password or SSO.</p>
        <label>
          Tenant ID
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          />
        </label>
        <p className="muted">
          Local dev: Acme tenant is prefilled. Demo tenant{' '}
          <code>57e8767b-9883-4a8d-b109-f330c57d4470</code> with{' '}
          <code>admin@demo.test</code>.
        </p>
        {localOn && (
          <>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
          </>
        )}
        {message && <p className="error">{message}</p>}
        {localOn && (
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        )}
        {oidc && (
          <button
            type="button"
            className="secondary-btn"
            disabled={busy || !tenantId}
            onClick={startOidc}
          >
            Continue with{' '}
            {oidc.settings.displayName ??
              (oidc.settings.mode === 'mock' ? 'SSO (mock)' : 'SSO')}
          </button>
        )}
        {saml && (
          <button
            type="button"
            className="secondary-btn"
            disabled={busy || !tenantId}
            onClick={startSaml}
          >
            Continue with{' '}
            {saml.settings.displayName ??
              (saml.settings.mode === 'mock' ? 'SAML (mock)' : 'SAML SSO')}
          </button>
        )}
        <p className="muted">
          Need a tenant? <Link to="/bootstrap">Bootstrap workspace</Link>
          {' · '}
          <Link to="/reset">Forgot password</Link>
        </p>
      </form>
    </div>
  );
}
