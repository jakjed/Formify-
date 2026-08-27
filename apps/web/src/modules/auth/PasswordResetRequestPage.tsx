import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch } from '../../shared/lib/api';

type ResetRequestResult = {
  ok: true;
  resetToken?: string;
  resetPath?: string;
};

export function PasswordResetRequestPage() {
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetPath, setResetPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setResetPath(null);
    try {
      const data = await apiFetch<ResetRequestResult>(
        '/api/auth/password-reset/request',
        {
          method: 'POST',
          body: JSON.stringify({ tenantId, email }),
        },
      );
      setMessage(
        'If that account exists, a reset link is ready (shown below in local/dev).',
      );
      if (data.resetPath) setResetPath(data.resetPath);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={(e) => void onSubmit(e)}>
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
        <p className="lede">Request a password reset.</p>
        <label>
          Tenant ID
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          />
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
        {message && <p className="ok">{message}</p>}
        {resetPath && (
          <p className="ok">
            Dev reset link: <Link to={resetPath}>{resetPath}</Link>
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <p className="muted">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
