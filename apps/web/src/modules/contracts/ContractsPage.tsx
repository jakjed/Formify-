import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import {
  CLM_TOOLS,
  CONTRACT_APPROVAL_CHAIN,
  ContractStatusBadge,
  ProcureKpis,
  ProcureStepper,
  ProcureTabs,
  ProgressBar,
  formatMoney,
} from '../procure/shared';

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
};

type Vendor = { id: string; code: string; name: string };
type Tab = 'setup' | 'approval' | 'signature';
type Composer = null | 'new' | 'ai';

function asSignature(raw: unknown): SignatureEnvelope | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SignatureEnvelope;
}

export function ContractsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('setup');
  const [rows, setRows] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [composer, setComposer] = useState<Composer>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (tab === 'setup' && statusFilter !== 'All') params.set('status', statusFilter);
    const qs = params.toString();
    const [contracts, vendorRows] = await Promise.all([
      apiFetch<Contract[]>(`/api/contracts${qs ? `?${qs}` : ''}`),
      apiFetch<Vendor[]>('/api/vendors'),
    ]);
    setRows(
      contracts.map((c) => ({ ...c, signatureJson: asSignature(c.signatureJson) })),
    );
    setVendors(vendorRows);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  const kpis = useMemo(() => {
    const all = rows;
    return [
      { label: 'Drafts', value: all.filter((c) => c.status === 'draft').length },
      {
        label: 'In approval',
        value: all.filter((c) => c.status === 'in_approval').length,
      },
      {
        label: 'Awaiting signature',
        value: all.filter((c) => c.status === 'pending_signature').length,
      },
      { label: 'Active', value: all.filter((c) => c.status === 'active').length },
    ];
  }, [rows]);

  const drafts = rows.filter((c) => c.status === 'draft');
  const inApproval = rows.filter((c) => c.status === 'in_approval');
  const pendingSig = rows.filter((c) => c.status === 'pending_signature');
  const completedSig = rows.filter(
    (c) => c.status === 'active' && c.signatureJson?.status === 'Completed',
  );

  async function run(action: () => Promise<void>, ok?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (ok) setMessage(ok);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const valueRaw = String(data.get('value') || '').trim();
    await run(async () => {
      await apiFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          number: data.get('number'),
          title: data.get('title'),
          vendorId: data.get('vendorId') || undefined,
          agreementType: data.get('agreementType') || undefined,
          clmTool: data.get('clmTool') || undefined,
          ownerName: data.get('ownerName') || undefined,
          termType: data.get('termType') || undefined,
          noticePeriod: data.get('noticePeriod') || undefined,
          valueMinor: valueRaw ? Math.round(parseFloat(valueRaw) * 100) : undefined,
        }),
      });
      setComposer(null);
    }, 'Draft created');
  }

  async function onAiIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await run(async () => {
      const created = await apiFetch<Contract>('/api/contracts/ai-intake', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: data.get('vendorId') || undefined,
          fileName: data.get('fileName') || undefined,
          title: data.get('title') || undefined,
        }),
      });
      setComposer(null);
      setMessage(`AI prefilled ${created.number} — review before approval`);
      await refresh();
    });
  }

  return (
    <section className="page procure">
      <div className="procure__header">
        <div className="procure__header-copy">
          <p className="eyebrow">Procure</p>
          <h1>Contracts</h1>
          <p className="lede">
            Draft, approve internally, then collect signatures — one clear path from
            intake to executed agreement.
          </p>
        </div>
      </div>

      <ProcureKpis items={kpis} />

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <ProcureTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'setup', label: 'Setup', count: rows.length },
          { id: 'approval', label: 'Approval', count: inApproval.length },
          { id: 'signature', label: 'Signature', count: pendingSig.length },
        ]}
      />

      {tab === 'setup' && (
        <>
          <div className="procure__toolbar">
            <div className="procure__toolbar-left">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void refresh().catch((err: Error) => setError(err.message));
                }}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                <input
                  className="procure__search"
                  placeholder="Search vendor or number…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select
                  className="procure__select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="in_approval">Under approval</option>
                  <option value="pending_signature">Pending signature</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button type="submit" className="btn btn--ghost" disabled={busy}>
                  Search
                </button>
              </form>
            </div>
            <div className="procure__toolbar-right">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => setComposer(composer === 'ai' ? null : 'ai')}
              >
                AI scan from supplier
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => setComposer(composer === 'new' ? null : 'new')}
              >
                + New contract
              </button>
            </div>
          </div>

          {composer === 'new' && (
            <div className="procure__composer">
              <h3>New contract draft</h3>
              <form className="workspace-form" onSubmit={(e) => void onCreate(e)}>
                <label>
                  Number
                  <input name="number" required placeholder="AGR-2026-1010" />
                </label>
                <label>
                  Title
                  <input name="title" required minLength={2} placeholder="Cloud MSA" />
                </label>
                <label>
                  Vendor
                  <select name="vendorId" defaultValue="">
                    <option value="">—</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Value
                  <input name="value" type="number" step="0.01" placeholder="120000" />
                </label>
                <label>
                  Type
                  <select name="agreementType" defaultValue="Vendor Agreement">
                    <option>Vendor Agreement</option>
                    <option>New Agreement</option>
                  </select>
                </label>
                <label>
                  CLM tool
                  <select name="clmTool" defaultValue={CLM_TOOLS[1]}>
                    {CLM_TOOLS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Owner
                  <input name="ownerName" placeholder="Budget owner" />
                </label>
                <label>
                  Term
                  <select name="termType" defaultValue="Fixed Term">
                    <option>Fixed Term</option>
                    <option>Auto-Renew</option>
                  </select>
                </label>
                <label className="span-2">
                  Notice period
                  <input name="noticePeriod" placeholder="60 days" defaultValue="60 days" />
                </label>
                <div className="span-2 actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setComposer(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    Create draft
                  </button>
                </div>
              </form>
            </div>
          )}

          {composer === 'ai' && (
            <div className="procure__composer">
              <h3>Upload from supplier · AI scan</h3>
              <div className="procure__ai" style={{ marginBottom: '0.85rem' }}>
                <div className="procure__ai-tag">How it works</div>
                Upload the supplier PDF. Aptora stubs extraction into a draft with a first-pass
                red-flag scan — you review, then send for approval.
              </div>
              <form className="workspace-form" onSubmit={(e) => void onAiIntake(e)}>
                <label>
                  File name
                  <input name="fileName" required placeholder="Nimbus_MSA.pdf" />
                </label>
                <label>
                  Vendor
                  <select name="vendorId" defaultValue="">
                    <option value="">—</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  Title (optional)
                  <input name="title" placeholder="Prefills if blank" />
                </label>
                <div className="span-2 actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setComposer(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    Scan with AI
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="procure__table-card">
            <div className="procure__table-wrap">
              <table className="procure__table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Number</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>CLM</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="is-clickable"
                      onClick={() => navigate(`/contracts/${c.id}`)}
                    >
                      <td>{c.vendor?.name ?? '—'}</td>
                      <td className="procure__mono">
                        {c.number}
                        {c.aiExtracted ? (
                          <span className="procure__muted"> · AI</span>
                        ) : null}
                      </td>
                      <td>{c.agreementType ?? '—'}</td>
                      <td className="procure__mono">
                        {formatMoney(c.valueMinor, c.currency)}
                      </td>
                      <td>
                        <ContractStatusBadge status={c.status} />
                      </td>
                      <td className="procure__muted">{c.clmTool ?? '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {c.status === 'draft' ? (
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                async () => {
                                  await apiFetch(
                                    `/api/contracts/${c.id}/send-for-approval`,
                                    { method: 'POST', body: '{}' },
                                  );
                                },
                                'Sent for approval',
                              )
                            }
                          >
                            Send for approval
                          </button>
                        ) : (
                          <Link className="btn btn--ghost" to={`/contracts/${c.id}`}>
                            Open
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="procure__empty">
                          <div className="procure__empty-icon">◇</div>
                          No contracts match these filters
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'approval' && (
        <>
          <div className="procure__notice procure__notice--info">
            Internal sign-off only — this is not a legal signature. Signing happens next
            via the Signature tab (mock DocuSign).
          </div>
          {drafts.length > 0 && (
            <div className="procure__card" style={{ marginBottom: '0.85rem' }}>
              <div className="procure__section-title">Awaiting submission</div>
              <p className="procure__section-desc">
                Drafts that have not entered the approval chain yet
              </p>
              <div className="procure__table-wrap">
                <table className="procure__table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Vendor</th>
                      <th>Value</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((c) => (
                      <tr key={c.id}>
                        <td className="procure__mono">{c.number}</td>
                        <td>{c.vendor?.name ?? '—'}</td>
                        <td className="procure__mono">
                          {formatMoney(c.valueMinor, c.currency)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiFetch(
                                  `/api/contracts/${c.id}/send-for-approval`,
                                  { method: 'POST', body: '{}' },
                                );
                              }, 'Sent for approval')
                            }
                          >
                            Send for approval
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="procure__muted" style={{ marginBottom: '0.75rem' }}>
            {inApproval.length} contract{inApproval.length === 1 ? '' : 's'} in the chain —
            Budget Owner → Legal → Tax → Compliance → Finance
          </p>

          <div className="procure__stack">
            {inApproval.map((c) => (
              <div key={c.id} className="procure__card">
                <div className="procure__card-head">
                  <div>
                    <h3 className="procure__card-title">
                      {c.number} · {c.vendor?.name ?? c.title}
                    </h3>
                    <p className="procure__card-sub">
                      {formatMoney(c.valueMinor, c.currency)}
                      {c.ownerName ? ` · Owner ${c.ownerName}` : ''}
                    </p>
                  </div>
                  <div className="procure__actions">
                    <Link className="btn btn--ghost" to={`/contracts/${c.id}`}>
                      View
                    </Link>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await apiFetch(`/api/contracts/${c.id}/advance-approval`, {
                            method: 'POST',
                            body: '{}',
                          });
                        }, 'Advanced')
                      }
                    >
                      Approve &amp; advance
                    </button>
                  </div>
                </div>
                <ProcureStepper
                  chain={CONTRACT_APPROVAL_CHAIN}
                  stage={c.approvalStage || 1}
                />
              </div>
            ))}
            {inApproval.length === 0 && (
              <div className="procure__empty procure__card">
                <div className="procure__empty-icon">✓</div>
                Nothing in approval right now
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'signature' && (
        <div className="procure__stack">
          <div className="procure__card">
            <div className="procure__section-title">Awaiting signature</div>
            <p className="procure__section-desc">
              Cleared internal approval — send or complete the mock DocuSign envelope
            </p>
            {pendingSig.length === 0 && (
              <div className="procure__empty">
                <div className="procure__empty-icon">✓</div>
                Nothing waiting on a signature
              </div>
            )}
            {pendingSig.map((c) => {
              const sig = c.signatureJson;
              const signers = sig?.signers ?? [];
              const signed = signers.filter((s) => s.status === 'Signed').length;
              const pct = signers.length
                ? Math.round((signed / signers.length) * 100)
                : 0;
              const allSigned =
                signers.length > 0 && signers.every((s) => s.status === 'Signed');
              return (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid var(--aptora-border)',
                    borderRadius: 'var(--aptora-radius-sm)',
                    padding: '1rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="procure__card-head" style={{ marginBottom: '0.5rem' }}>
                    <div>
                      <h3 className="procure__card-title">
                        {c.number} · {c.vendor?.name ?? c.title}
                      </h3>
                      <p className="procure__card-sub">
                        {sig?.envelopeId
                          ? `Envelope ${sig.envelopeId} · sent ${sig.sentAt ?? '—'}`
                          : 'Envelope not yet sent'}
                      </p>
                    </div>
                    <div className="procure__actions">
                      <Link className="btn btn--ghost" to={`/contracts/${c.id}`}>
                        View
                      </Link>
                      {!sig?.envelopeId && (
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await apiFetch(
                                `/api/contracts/${c.id}/send-for-signature`,
                                { method: 'POST', body: '{}' },
                              );
                            }, 'Sent via DocuSign')
                          }
                        >
                          Send via DocuSign
                        </button>
                      )}
                    </div>
                  </div>
                  {sig?.envelopeId && (
                    <div className="procure__notice procure__notice--info">
                      Signing happens outside Aptora. When every party has signed, complete
                      the contract with the executed copy.
                    </div>
                  )}
                  <ProgressBar value={pct} />
                  <table className="procure__table">
                    <thead>
                      <tr>
                        <th>Signer</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Signed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signers.map((s) => (
                        <tr key={`${s.name}-${s.role}`}>
                          <td>{s.name}</td>
                          <td className="procure__muted">{s.role}</td>
                          <td>{s.status}</td>
                          <td className="procure__mono">{s.signedAt ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sig?.envelopeId && (
                    <div className="procure__actions" style={{ marginTop: '0.75rem' }}>
                      {!allSigned && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await apiFetch(
                                `/api/contracts/${c.id}/check-signature`,
                                { method: 'POST', body: '{}' },
                              );
                            }, 'DocuSign status updated')
                          }
                        >
                          Check DocuSign status
                        </button>
                      )}
                      {allSigned && (
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await apiFetch(
                                `/api/contracts/${c.id}/complete-signature`,
                                {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    fileName: 'executed-agreement.pdf',
                                  }),
                                },
                              );
                            }, 'Contract executed')
                          }
                        >
                          Complete with executed copy
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="procure__card">
            <div className="procure__section-title">Recently completed</div>
            <p className="procure__section-desc">Fully executed envelopes</p>
            {completedSig.length === 0 ? (
              <div className="procure__empty">No completed envelopes yet</div>
            ) : (
              <table className="procure__table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Vendor</th>
                    <th>Envelope</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {completedSig.map((c) => (
                    <tr key={c.id} className="is-clickable" onClick={() => navigate(`/contracts/${c.id}`)}>
                      <td className="procure__mono">{c.number}</td>
                      <td>{c.vendor?.name ?? '—'}</td>
                      <td className="procure__mono">
                        {c.signatureJson?.envelopeId ?? '—'}
                      </td>
                      <td>
                        <ContractStatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
