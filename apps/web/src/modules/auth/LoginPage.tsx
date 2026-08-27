import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';

export function LoginPage() {
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, email, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      const msg = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message ?? 'Login failed';
      setMessage(msg);
      return;
    }
    const data = (await res.json()) as { token: string };
    sessionStorage.setItem('aptora_token', data.token);
    navigate('/');
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
        <button type="submit">Sign in</button>
        <p className="muted">
          Dev bootstrap: create a tenant via <code>POST /api/tenants</code>, then{' '}
          <code>POST /api/auth/register</code>. <Link to="/">Back</Link>
        </p>
      </form>
    </div>
  );
}
