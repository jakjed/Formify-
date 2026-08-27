import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, setSession } from '../../shared/lib/api';

type Tenant = { id: string; name: string; slug: string };
type LoginResponse = {
  token: string;
  user: { tenantId: string };
};

export function BootstrapPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('Acme');
  const [slug, setSlug] = useState('acme');
  const [region, setRegion] = useState<'us' | 'eu'>('eu');
  const [email, setEmail] = useState('admin@acme.test');
  const [displayName, setDisplayName] = useState('Admin');
  const [password, setPassword] = useState('password1');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        body: JSON.stringify({ tenantId: tenant.id, email, password }),
      });
      setSession(login.token, login.user.tenantId);
      navigate('/directory');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={onSubmit}>
        <div className="auth__brand">
          <img
            className="auth__mark"
            src="/brand/aptora-mark.png"
            width={72}
            height={72}
            alt=""
          />
          <h1>{PRODUCT_NAME}</h1>
        </div>
        <p className="lede">Create a tenant and first admin (local bootstrap).</p>
        <label>
          Company name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Slug
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
        </label>
        <label>
          Region
          <select value={region} onChange={(e) => setRegion(e.target.value as 'us' | 'eu')}>
            <option value="eu">EU</option>
            <option value="us">US</option>
          </select>
        </label>
        <label>
          Admin email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
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
      </form>
    </div>
  );
}
