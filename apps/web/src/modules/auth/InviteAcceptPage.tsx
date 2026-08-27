import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { apiFetch, setSession } from '../../shared/lib/api';

type InviteInfo = {
  email: string;
  displayName: string;
  role: string;
  tenantId: string;
  tenantName: string;
  expiresAt: string;
};

type AcceptResponse = {
  token: string;
  user: { tenantId: string };
};

export function InviteAcceptPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<InviteInfo>(`/api/auth/invite/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((err: Error) => setMessage(err.message));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = await apiFetch<AcceptResponse>('/api/auth/invite/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSession(data.token, data.user.tenantId);
      navigate('/');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Accept failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={(e) => void onSubmit(e)}>
        <h1>{PRODUCT_NAME}</h1>
        <p className="lede">Accept invite and set your password.</p>
        {info && (
          <p className="muted">
            {info.displayName} · {info.email} · {info.tenantName} ({info.role})
          </p>
        )}
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
        <button type="submit" disabled={busy || !info}>
          {busy ? 'Saving…' : 'Activate account'}
        </button>
        <p className="muted">
          Already activated? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
