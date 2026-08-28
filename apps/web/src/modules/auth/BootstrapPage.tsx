import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, setSession } from '../../shared/lib/api';
import { AuthBrand, AuthLegalFooter } from './AuthChrome';

type Tenant = { id: string; name: string; slug: string };
type LoginResponse = { token: string; user: { tenantId: string } };

export function BootstrapPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [region, setRegion] = useState<'us' | 'eu'>('eu');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<{ allowed: boolean }>('/api/tenants/bootstrap-status')
      .then((s) => {
        setAllowed(s.allowed);
        if (!s.allowed) navigate('/waitlist', { replace: true });
      })
      .catch(() => navigate('/waitlist', { replace: true }));
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const tenant = await apiFetch<Tenant>('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, slug, region }),
      });
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: tenant.id,
          email,
          displayName,
          password,
        }),
      });
      const login = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ slug: tenant.slug, email, password }),
      });
      if ('token' in login) {
        setSession(login.token, login.user.tenantId);
        localStorage.setItem('aptora_workspace_slug', tenant.slug);
        navigate('/');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not create workspace');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) {
    return (
      <div className="auth">
        <div className="auth__card">
          <p className="muted">Checking availability…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={(e) => void onSubmit(e)}>
        <AuthBrand />
        <p className="lede">Create a workspace and first admin.</p>
        <label>
          Company name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, ''),
                );
              }
            }}
            required
          />
        </label>
        <label>
          Workspace slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9-]+"
          />
        </label>
        <label>
          Region
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as 'us' | 'eu')}
          >
            <option value="eu">EU</option>
            <option value="us">US</option>
          </select>
        </label>
        <label>
          Admin email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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
        {message && <p className="error">{message}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create workspace'}
        </button>
        <p className="muted">
          Already set up? <Link to="/login">Sign in</Link>
        </p>
        <AuthLegalFooter />
      </form>
    </div>
  );
}
