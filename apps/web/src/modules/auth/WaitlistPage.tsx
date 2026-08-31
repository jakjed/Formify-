import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import { AuthBrand, AuthLegalFooter } from './AuthChrome';

export function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email, company }),
      });
      setMessage('You’re on the list. We’ll be in touch.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not join waitlist');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={(e) => void onSubmit(e)}>
        <AuthBrand />
        <p className="lede">
          New workspaces are invite-only. Join the waitlist and we’ll open a
          tenant when you’re ready.
        </p>
        <label>
          Work email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Company
          <input value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        {message && <p className="ok">{message}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Join waitlist'}
        </button>
        <p className="muted">
          Already have a workspace? <Link to="/login">Sign in</Link>
        </p>
        <AuthLegalFooter />
      </form>
    </div>
  );
}
