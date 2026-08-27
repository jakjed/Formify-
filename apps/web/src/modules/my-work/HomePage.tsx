import { useEffect, useState } from 'react';
import { PRODUCT_NAME, PHASE1_MODULES } from '@aptora/types';

type Health = {
  status: string;
  product: string;
  phase1Modules: string[];
  database?: string;
  timestamp: string;
};

export function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return (await res.json()) as Health;
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="page">
      <p className="eyebrow">Phase 1 foundation</p>
      <h1>{PRODUCT_NAME}</h1>
      <p className="lede">
        Modular AP workspace. Enabled modules:{' '}
        {PHASE1_MODULES.join(', ')}.
      </p>
      <div className="panel">
        <h2>API health</h2>
        {error && <p className="error">Cannot reach API ({error}). Start `@aptora/api` on :3001.</p>}
        {health && (
          <dl className="kv">
            <div>
              <dt>Status</dt>
              <dd>{health.status}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{health.product}</dd>
            </div>
            <div>
              <dt>Modules</dt>
              <dd>{health.phase1Modules.join(', ')}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{health.database ?? 'unknown'}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{new Date(health.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        )}
        {!health && !error && <p>Checking API…</p>}
      </div>
    </section>
  );
}
