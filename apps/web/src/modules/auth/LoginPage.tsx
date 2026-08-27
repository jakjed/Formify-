import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, setSession } from '../../shared/lib/api';

type LoginResponse = {
  token: string;
  user: { tenantId: string; email: string; displayName: string };
};

export function LoginPage() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('admin@acme.test');
  const [password, setPassword] = useState('password1');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={onSubmit}>
        <h1>{PRODUCT_NAME}</h1>
        <p className="lede">Sign in with username / password (local auth).</p>
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
        </label>
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
        {message && <p className="error">{message}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted">
          Need a tenant? <Link to="/bootstrap">Bootstrap workspace</Link>
          {' · '}
          <Link to="/reset">Forgot password</Link>
        </p>
      </form>
    </div>
  );
}
