import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch } from '../../shared/lib/api';

type ResetInfo = {
  email: string;
  tenantId: string;
  tenantName: string;
  expiresAt: string;
};

export function PasswordResetConfirmPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<ResetInfo | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<ResetInfo>(
      `/api/auth/password-reset/${encodeURIComponent(token)}`,
    )
      .then(setInfo)
      .catch((err: Error) => setMessage(err.message));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      navigate('/login');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Reset failed');
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
        <p className="lede">Choose a new password.</p>
        {info && (
          <p className="muted">
            {info.email} · {info.tenantName}
          </p>
        )}
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {message && <p className="error">{message}</p>}
        <button type="submit" disabled={busy || !info}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
        <p className="muted">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
