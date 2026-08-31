import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/lib/api';

type Me = { email: string; totpEnabled?: boolean };

export function SecurityPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setMe(await apiFetch<Me>('/api/auth/me'));
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ secret: string; otpauthUrl: string }>(
        '/api/auth/mfa/setup',
        { method: 'POST' },
      );
      setSecret(data.secret);
      setOtpauth(data.otpauthUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setMessage('Authenticator enabled.');
      setSecret(null);
      setOtpauth(null);
      setCode('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setMessage('Authenticator disabled.');
      setCode('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Account</p>
      <h1>Security</h1>
      <p className="lede">
        Optional authenticator app (TOTP) for your sign-in. Recommended for
        admins.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}
      <div className="panel">
        <h2>Two-factor authentication</h2>
        <p className="muted">
          Status:{' '}
          <strong>{me?.totpEnabled ? 'Enabled' : 'Off'}</strong>
          {me?.email ? ` · ${me.email}` : ''}
        </p>
        {!me?.totpEnabled && !secret && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void startSetup()}
          >
            Set up authenticator
          </button>
        )}
        {secret && (
          <form onSubmit={(e) => void confirm(e)}>
            <p>
              Scan this otpauth URL in your authenticator, or enter the secret
              manually.
            </p>
            <p>
              <code className="auth__secret">{secret}</code>
            </p>
            {otpauth && (
              <p className="muted" style={{ wordBreak: 'break-all' }}>
                {otpauth}
              </p>
            )}
            <label>
              Code from app
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                required
                minLength={6}
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Confirm
            </button>
          </form>
        )}
        {me?.totpEnabled && (
          <form onSubmit={(e) => void disable(e)}>
            <label>
              Current code to disable
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                required
                minLength={6}
              />
            </label>
            <button type="submit" className="btn btn--danger-ghost" disabled={busy}>
              Disable MFA
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
