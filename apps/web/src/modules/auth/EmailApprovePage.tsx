import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthBrand, AuthLegalFooter } from '../auth/AuthChrome';

type Preview = {
  taskId: string;
  status: string;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    vendorNameRaw: string | null;
    totalMinor: number | null;
    currency: string;
    exceptions: { code: string; message: string }[];
  } | null;
};

function formatMoney(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export function EmailApprovePage() {
  const { token } = useParams();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/approvals/email/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('This approval link is invalid or already used.');
        setPreview((await res.json()) as Preview);
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  async function decide(decision: 'approve' | 'reject') {
    if (!token) return;
    if (decision === 'reject' && !comment.trim()) {
      setError('A comment is required when rejecting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/email/${token}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Could not record decision');
      }
      setDone(decision === 'approve' ? 'Approved' : 'Rejected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <AuthBrand />
        <h2>Invoice approval</h2>
        {error && <p className="error">{error}</p>}
        {done && <p className="ok">{done}</p>}
        {preview?.invoice && !done && (
          <>
            <p className="lede">
              {preview.invoice.invoiceNumber ?? 'Draft invoice'} ·{' '}
              {preview.invoice.vendorNameRaw ?? 'Vendor'} ·{' '}
              {formatMoney(
                preview.invoice.totalMinor,
                preview.invoice.currency,
              )}
            </p>
            {preview.invoice.exceptions.length > 0 && (
              <ul>
                {preview.invoice.exceptions.map((x) => (
                  <li key={x.code}>
                    {x.code}: {x.message}
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
              }}
            >
              <label>
                Comment (required to reject)
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </label>
              <div className="approval-card__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => void decide('approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  disabled={busy}
                  onClick={() => void decide('reject')}
                >
                  Reject
                </button>
              </div>
            </form>
          </>
        )}
        <p className="muted">
          <Link to="/login">Sign in to Aptora</Link>
        </p>
        <AuthLegalFooter />
      </div>
    </div>
  );
}
