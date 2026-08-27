import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

const APPROVAL_CHAIN = [
  'Budget Owner',
  'Legal',
  'Tax',
  'Compliance',
  'Finance',
] as const;

const CLM_TOOLS = ['Conga', 'Docusign CLM', 'PandaDoc', 'IronClad'] as const;

const STATUS_FILTERS = [
  'All',
  'draft',
  'in_approval',
  'pending_signature',
  'active',
  'expired',
  'cancelled',
] as const;

type SignatureSigner = {
  name: string;
  role: string;
  status: string;
  signedAt: string | null;
};

type SignatureEnvelope = {
  status: string;
  envelopeId: string | null;
  sentAt: string | null;
  signers: SignatureSigner[];
};

type Contract = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  valueMinor: number | null;
  agreementType: string | null;
  clmTool: string | null;
  ownerName: string | null;
  approvalStage: number;
  aiExtracted: boolean;
  signatureJson: SignatureEnvelope | null;
  vendor: { id: string; code: string; name: string } | null;
  createdAt: string;
};

type Vendor = { id: string; code: string; name: string };

type Tab = 'setup' | 'approval' | 'signature';

function formatMoney(minor: number | null, currency: string) {
  if (minor == null) return '—';
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function readSignature(raw: unknown): SignatureEnvelope | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SignatureEnvelope;
}

export function ContractsPage() {
  const [tab, setTab] = useState<Tab>('setup');
  const [rows, setRows] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>('All');
  const [showNew, setShowNew] = useState(false);
  const [showAiIntake, setShowAiIntake] = useState(false);
  const [completeFileName, setCompleteFileName] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(opts?: { q?: string; status?: string }) {
    const search = opts?.q ?? q;
    const status = opts?.status ?? statusFilter;
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (status && status !== 'All') params.set('status', status);
    const qs = params.toString();
    const [contracts, vendorRows] = await Promise.all([
      apiFetch<Contract[]>(`/api/contracts${qs ? `?${qs}` : ''}`),
      apiFetch<Vendor[]>('/api/vendors'),
    ]);
    setRows(
      contracts.map((c) => ({
        ...c,
        signatureJson: readSignature(c.signatureJson),
      })),
    );
    setVendors(vendorRows);
  }

  useEffect(() => {
    // Approval / Signature need the full set; Setup respects the status filter.
    const status = tab === 'setup' ? statusFilter : 'All';
    void refresh({ status }).catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }

  async function onStatusChange(next: (typeof STATUS_FILTERS)[number]) {
    setStatusFilter(next);
    setError(null);
    try {
      await refresh({ status: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const valueRaw = String(data.get('value') || '').trim();
      await apiFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          vendorId: data.get('vendorId') || undefined,
          valueMinor: valueRaw
            ? Math.round(parseFloat(valueRaw) * 100)
            : undefined,
          agreementType: data.get('agreementType') || undefined,
          clmTool: data.get('clmTool') || undefined,
          ownerName: data.get('ownerName') || undefined,
          termType: data.get('termType') || undefined,
          noticePeriod: data.get('noticePeriod') || undefined,
        }),
      });
      form.reset();
      setShowNew(false);
      setMessage('Contract draft created.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAiIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<Contract>('/api/contracts/ai-intake', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: data.get('vendorId') || undefined,
          fileName: data.get('fileName') || undefined,
          title: data.get('title') || undefined,
        }),
      });
      form.reset();
      setShowAiIntake(false);
      setMessage(`AI intake created ${created.number}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI intake failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendForApproval(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/contracts/${id}/send-for-approval`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage('Sent for approval.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function advanceApproval(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/contracts/${id}/advance-approval`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage('Approval advanced.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advance failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendForSignature(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/contracts/${id}/send-for-signature`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage('Sent for signature (mock DocuSign).');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function checkSignature(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/contracts/${id}/check-signature`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage('Signature status updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }

  async function completeSignature(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const fileName = completeFileName[id]?.trim();
      await apiFetch(`/api/contracts/${id}/complete-signature`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: fileName || undefined,
        }),
      });
      setMessage('Signature completed — contract active.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Complete failed');
    } finally {
      setBusy(false);
    }
  }

  const inApproval = rows.filter((r) => r.status === 'in_approval');
  const drafts = rows.filter((r) => r.status === 'draft');
  const pendingSig = rows.filter((r) => r.status === 'pending_signature');
  const recentlyCompleted = rows.filter((r) => {
    const sig = readSignature(r.signatureJson);
    return r.status === 'active' && sig?.status === 'Completed';
  });

  return (
    <section className="page">
      <p className="eyebrow">Procure</p>
      <h1>Contracts</h1>
      <p className="lede">
        Setup, internal approval, and e-signature — Gabi / Ledgerline parity.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="tabs">
        {(
          [
            ['setup', 'Setup'],
            ['approval', 'Approval'],
            ['signature', 'Signature'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tabs__btn tabs__btn--active' : 'tabs__btn'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'setup' && (
        <div className="panel">
          <form className="actions" onSubmit={(e) => void onSearch(e)}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contracts…"
              aria-label="Search contracts"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                void onStatusChange(
                  e.target.value as (typeof STATUS_FILTERS)[number],
                )
              }
              aria-label="Status filter"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All statuses' : s}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary-btn" disabled={busy}>
              Search
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={() => {
                setShowAiIntake((v) => !v);
                setShowNew(false);
              }}
            >
              Upload from Supplier &amp; Scan with AI
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowNew((v) => !v);
                setShowAiIntake(false);
              }}
            >
              + New Contract
            </button>
          </form>

          {showNew && (
            <form
              className="workspace-form"
              style={{ marginTop: '1rem' }}
              onSubmit={(e) => void onCreate(e)}
            >
              <label>
                Number
                <input name="number" required placeholder="C-1001" />
              </label>
              <label>
                Title
                <input
                  name="title"
                  required
                  minLength={2}
                  placeholder="Office supply MSA"
                />
              </label>
              <label>
                Vendor
                <select name="vendorId" defaultValue="">
                  <option value="">— none —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Value
                <input name="value" inputMode="decimal" placeholder="1000.00" />
              </label>
              <label>
                Agreement type
                <input name="agreementType" placeholder="MSA / SOW / NDA" />
              </label>
              <label>
                CLM tool
                <select name="clmTool" defaultValue="">
                  <option value="">— none —</option>
                  {CLM_TOOLS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Owner
                <input name="ownerName" placeholder="Budget owner name" />
              </label>
              <label>
                Term type
                <input name="termType" placeholder="Fixed / Auto-renew" />
              </label>
              <label>
                Notice period
                <input name="noticePeriod" placeholder="30 days" />
              </label>
              <div className="span-2 actions">
                <button type="submit" disabled={busy}>
                  Create draft
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowNew(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {showAiIntake && (
            <form
              className="workspace-form"
              style={{ marginTop: '1rem' }}
              onSubmit={(e) => void onAiIntake(e)}
            >
              <label>
                File name
                <input
                  name="fileName"
                  placeholder="supplier-msa.pdf"
                  required
                />
              </label>
              <label>
                Title (optional)
                <input name="title" placeholder="AI-extracted title" />
              </label>
              <label>
                Vendor (optional)
                <select name="vendorId" defaultValue="">
                  <option value="">— none —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="span-2 actions">
                <button type="submit" disabled={busy}>
                  Scan with AI
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAiIntake(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <ul className="task-list" style={{ marginTop: '1rem' }}>
            {rows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    <Link to={`/contracts/${row.id}`}>
                      {row.number} · {row.title}
                    </Link>
                  </strong>
                  {row.aiExtracted && (
                    <span className="muted"> · AI extracted</span>
                  )}
                  <span className="muted">
                    {' '}
                    · {row.status}
                    {row.vendor ? ` · ${row.vendor.name}` : ''}
                    {row.agreementType ? ` · ${row.agreementType}` : ''}
                    {row.clmTool ? ` · ${row.clmTool}` : ''}
                    {` · ${formatMoney(row.valueMinor, row.currency)}`}
                  </span>
                </div>
                <div className="actions">
                  {row.status === 'draft' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void sendForApproval(row.id)}
                    >
                      Send for Approval
                    </button>
                  )}
                  <Link to={`/contracts/${row.id}`} className="secondary-btn">
                    View →
                  </Link>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="muted">No contracts match your filters.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'approval' && (
        <div className="panel">
          <p className="muted">
            Internal sign-off only — Budget Owner → Legal → Tax → Compliance →
            Finance. Signing happens separately via DocuSign.
          </p>

          <h2>Awaiting submission</h2>
          <ul className="task-list">
            {drafts.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    <Link to={`/contracts/${row.id}`}>
                      {row.number} · {row.title}
                    </Link>
                  </strong>
                  <span className="muted">
                    {' '}
                    · {row.vendor?.name ?? '—'} ·{' '}
                    {formatMoney(row.valueMinor, row.currency)}
                  </span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendForApproval(row.id)}
                  >
                    Send for Approval
                  </button>
                </div>
              </li>
            ))}
            {drafts.length === 0 && (
              <li className="muted">No drafts awaiting submission.</li>
            )}
          </ul>

          <h2 style={{ marginTop: '1.5rem' }}>In approval</h2>
          <p className="muted">
            {inApproval.length} contract
            {inApproval.length === 1 ? '' : 's'} in the approval chain.
          </p>
          <ul className="task-list">
            {inApproval.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    <Link to={`/contracts/${row.id}`}>
                      {row.number} · {row.title}
                    </Link>
                  </strong>
                  <span className="muted">
                    {' '}
                    · {row.vendor?.name ?? '—'} ·{' '}
                    {formatMoney(row.valueMinor, row.currency)}
                    {row.ownerName ? ` · Owner ${row.ownerName}` : ''}
                  </span>
                  <p className="muted">
                    Stage {row.approvalStage}/5:{' '}
                    {APPROVAL_CHAIN.map((label, i) => {
                      const stage = i + 1;
                      const marker =
                        stage < row.approvalStage
                          ? '✓'
                          : stage === row.approvalStage
                            ? '●'
                            : '○';
                      return (
                        <span key={label}>
                          {i > 0 ? ' → ' : ''}
                          {marker} {label}
                        </span>
                      );
                    })}
                  </p>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advanceApproval(row.id)}
                  >
                    Approve &amp; advance
                  </button>
                </div>
              </li>
            ))}
            {inApproval.length === 0 && (
              <li className="muted">No contracts currently in approval.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'signature' && (
        <div className="panel">
          <h2>Awaiting signature</h2>
          <p className="muted">
            Cleared internal approval — send or complete via mock DocuSign.
          </p>
          <ul className="task-list">
            {pendingSig.map((row) => {
              const sig = readSignature(row.signatureJson);
              const allSigned =
                !!sig?.signers?.length &&
                sig.signers.every((s) => s.status === 'Signed');
              return (
                <li key={row.id}>
                  <div>
                    <strong>
                      <Link to={`/contracts/${row.id}`}>
                        {row.number} · {row.title}
                      </Link>
                    </strong>
                    <span className="muted">
                      {' '}
                      · {row.vendor?.name ?? '—'}
                      {sig?.envelopeId
                        ? ` · Envelope ${sig.envelopeId}`
                        : ' · Envelope not yet sent'}
                    </span>
                    {sig?.signers?.length ? (
                      <p className="muted">
                        {sig.signers
                          .map((s) => `${s.name} (${s.role}): ${s.status}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="actions">
                    {(!sig?.envelopeId || sig.status === 'Not started') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void sendForSignature(row.id)}
                      >
                        Send for Signature
                      </button>
                    )}
                    {sig?.envelopeId && !allSigned && (
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={busy}
                        onClick={() => void checkSignature(row.id)}
                      >
                        Check DocuSign status
                      </button>
                    )}
                    {allSigned && (
                      <>
                        <input
                          placeholder="Executed file name"
                          value={completeFileName[row.id] ?? ''}
                          onChange={(e) =>
                            setCompleteFileName((m) => ({
                              ...m,
                              [row.id]: e.target.value,
                            }))
                          }
                          style={{ width: '10rem' }}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void completeSignature(row.id)}
                        >
                          Complete signature
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {pendingSig.length === 0 && (
              <li className="muted">Nothing waiting on a signature.</li>
            )}
          </ul>

          <h2 style={{ marginTop: '1.5rem' }}>Recently completed</h2>
          <ul className="task-list">
            {recentlyCompleted.map((row) => {
              const sig = readSignature(row.signatureJson);
              return (
                <li key={row.id}>
                  <div>
                    <strong>
                      <Link to={`/contracts/${row.id}`}>
                        {row.number} · {row.title}
                      </Link>
                    </strong>
                    <span className="muted">
                      {' '}
                      · {row.vendor?.name ?? '—'}
                      {sig?.envelopeId ? ` · ${sig.envelopeId}` : ''}
                      {' · signature Completed'}
                    </span>
                  </div>
                </li>
              );
            })}
            {recentlyCompleted.length === 0 && (
              <li className="muted">No completed envelopes yet.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
