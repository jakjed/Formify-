import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setSession } from '../../shared/lib/api';

export function OidcCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const tenantId = params.get('tenantId');
    const next = params.get('next') || '/';
    if (!token || !tenantId) {
      setError('Missing SSO session parameters');
      return;
    }
    setSession(token, tenantId);
    navigate(next, { replace: true });
  }, [params, navigate]);

  return (
    <div className="auth">
      <div className="auth__card">
        <h1>Signing in…</h1>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p className="muted">Completing SSO session.</p>
        )}
      </div>
    </div>
  );
}
