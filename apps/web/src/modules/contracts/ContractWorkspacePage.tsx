import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';
import {
  CLM_TOOLS,
  CONTRACT_APPROVAL_CHAIN,
  ContractStatusBadge,
  DOC_CATEGORIES,
  Kv,
  ApprovalProgress,
  formatMoney,
} from '../procure/shared';

type Party = { id: string; code: string; name: string };
type Flag = { severity: string; text: string };
type Doc = { id: string; category: string; fileName: string; createdAt: string };
type Sig = {
  status: string;
  envelopeId: string | null;
  sentAt: string | null;
  signers: { name: string; role: string; status: string; signedAt: string | null }[];
};
type Contract = {
  id: string; number: string; title: string; status: string; currency: string;
  valueMinor: number | null; vendorId: string | null; entityId: string | null;
  startDate: string | null; endDate: string | null; notes: string | null;
  agreementType: string | null; purpose: string | null; serviceDescription: string | null;
  costCenter: string | null; termType: string | null; noticePeriod: string | null;
  clmTool: string | null; ownerName: string | null; approvalStage: number;
  contractDate: string | null; aiExtracted: boolean; redFlagsJson: Flag[] | null;
  signatureJson: Sig | null; documents: Doc[]; vendor: Party | null; entity: Party | null;
};
type Activity =
  | { id: string; kind: 'audit'; at: string; actorName: string | null; action: string }
  | { id: string; kind: 'comment'; at: string; actorName: string | null; body: string };
type Comment = { id: string; authorName: string; body: string; createdAt: string };

const LABELS: Record<string, string> = {
  'contract.created': 'Created contract',
  'contract.updated': 'Updated contract fields',
  'contract.status': 'Changed status',
  'contract.amended': 'Amended contract',
  'contract.renewed': 'Renewed end date',
  'contract.send_for_approval': 'Sent for approval',
  'contract.advance_approval': 'Advanced approval',
  'contract.send_for_signature': 'Sent for signature',
  'contract.check_signature': 'Checked signature status',
  'contract.complete_signature': 'Completed signature',
  'contract.ai_intake': 'AI document intake',
  'contract.scan_red_flags': 'Scanned red flags',
  'contract.document_added': 'Added document',
  'contract.document_removed': 'Removed document',
};

const d = (v: string | null) => (v ? v.slice(0, 10) : '');
const dash = (v: string | null | undefined) => (v?.trim() ? v : '—');
const fromMajor = (v: string) => (v.trim() === '' ? null : Math.round(parseFloat(v) * 100));
const toMajor = (m: number | null) => (m == null ? '' : (m / 100).toFixed(2));
const asSig = (raw: unknown) => (raw && typeof raw === 'object' ? (raw as Sig) : null);
const asFlags = (raw: unknown) => (Array.isArray(raw) ? (raw as Flag[]) : []);
const f = (data: FormData, key: string) => {
  const v = String(data.get(key) ?? '').trim();
  return v || null;
};

export function ContractWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [entities, setEntities] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [redFlags, setRedFlags] = useState<Flag[]>([]);
  const [docFileName, setDocFileName] = useState('');
  const [docCategory, setDocCategory] = useState(DOC_CATEGORIES[0]?.key ?? 'draft');
  const [completeFileName, setCompleteFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  function apply(row: Contract) {
    const next = {
      ...row,
      signatureJson: asSig(row.signatureJson),
      redFlagsJson: asFlags(row.redFlagsJson),
      documents: row.documents ?? [],
    };
    setContract(next);
    setRedFlags(next.redFlagsJson ?? []);
  }

  async function loadSides(cid: string) {
    const [acts, cmts] = await Promise.all([
      apiFetch<Activity[]>(`/api/contracts/${cid}/activity`),
      apiFetch<Comment[]>(`/api/contracts/${cid}/comments`),
    ]);
    setActivity(acts);
    setComments(cmts);
  }

  async function refresh() {
    if (!id) return;
    const [row, vs, es] = await Promise.all([
      apiFetch<Contract>(`/api/contracts/${id}`),
      apiFetch<Party[]>('/api/vendors'),
      apiFetch<Party[]>('/api/entities'),
    ]);
    apply(row);
    setVendors(vs);
    setEntities(es);
    await loadSides(id);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(fn: () => Promise<void>, ok?: string, useBusy = true) {
    if (useBusy) setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage(ok);
      if (id) await loadSides(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      if (useBusy) setBusy(false);
    }
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id || !contract) return;
    const data = new FormData(e.currentTarget);
    const body = {
      title: String(data.get('title') || '').trim(),
      vendorId: f(data, 'vendorId'),
      entityId: f(data, 'entityId'),
      currency: String(data.get('currency') || contract.currency).trim() || 'EUR',
      valueMinor: fromMajor(String(data.get('value') || '')),
      startDate: f(data, 'startDate'),
      endDate: f(data, 'endDate'),
      notes: f(data, 'notes'),
      agreementType: f(data, 'agreementType'),
      purpose: f(data, 'purpose'),
      serviceDescription: f(data, 'serviceDescription'),
      costCenter: f(data, 'costCenter'),
      termType: f(data, 'termType'),
      noticePeriod: f(data, 'noticePeriod'),
      clmTool: f(data, 'clmTool'),
      ownerName: f(data, 'ownerName'),
      contractDate: f(data, 'contractDate'),
    };
    await run(async () => {
      apply(
        contract.status === 'active'
          ? await apiFetch<Contract>(`/api/contracts/${id}/amend`, {
              method: 'POST',
              body: JSON.stringify({
                title: body.title,
                valueMinor: body.valueMinor,
                startDate: body.startDate,
                endDate: body.endDate,
                notes: body.notes,
              }),
            })
          : await apiFetch<Contract>(`/api/contracts/${id}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            }),
      );
      setEditing(false);
    }, contract.status === 'active' ? 'Amended.' : 'Saved.');
  }

  async function transition(status: string) {
    if (!id) return;
    await run(async () => {
      apply(
        await apiFetch<Contract>(`/api/contracts/${id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        }),
      );
    }, `Status → ${status}`, false);
  }

  async function postAction(path: string, body?: Record<string, unknown>, ok?: string) {
    if (!id) return;
    await run(async () => {
      apply(
        await apiFetch<Contract>(`/api/contracts/${id}/${path}`, {
          method: 'POST',
          body: JSON.stringify(body ?? {}),
        }),
      );
    }, ok ?? 'Done.');
  }

  if (!contract) {
    return (
      <section className="page procure">
        <p className="eyebrow">Procure</p>
        <h1>Contract</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
      </section>
    );
  }

  const locked = contract.status === 'expired' || contract.status === 'cancelled';
  const isActive = contract.status === 'active';
  const canPatch = contract.status === 'draft' || contract.status === 'in_approval';
  const canEdit = !locked && (canPatch || isActive);
  const sig = asSig(contract.signatureJson);
  const allSigned = !!sig?.signers?.length && sig.signers.every((s) => s.status === 'Signed');
  const showApproval = contract.approvalStage > 0 || contract.status === 'in_approval';
  const st = contract.status;

  return (
    <section className="page procure">
      <div className="procure__workspace-top">
        <div>
          <Link className="procure__back" to="/contracts">← Contracts</Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ margin: 0 }}>
              {contract.number}
              <span className="procure__muted"> · {contract.title}</span>
            </h1>
            <ContractStatusBadge status={st} />
          </div>
          <p className="lede" style={{ marginTop: '0.35rem' }}>
            {[
              contract.vendor?.name,
              contract.ownerName ? `Owner ${contract.ownerName}` : null,
              contract.clmTool,
              formatMoney(contract.valueMinor, contract.currency),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="procure__actions">
          {st === 'draft' && (
            <>
              <button type="button" className="btn btn--primary" disabled={busy}
                onClick={() => void postAction('send-for-approval', {}, 'Sent for approval.')}>
                Send for approval
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void transition('cancelled')}>
                Cancel
              </button>
            </>
          )}
          {st === 'in_approval' && (
            <>
              <button type="button" className="btn btn--primary" disabled={busy}
                onClick={() => void postAction('advance-approval', {}, 'Approval advanced.')}>
                Approve &amp; advance
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void transition('draft')}>
                Send back
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void transition('cancelled')}>
                Cancel
              </button>
            </>
          )}
          {st === 'pending_signature' && (
            <>
              {(!sig?.envelopeId || sig.status === 'Not started') && (
                <button type="button" className="btn btn--primary" disabled={busy}
                  onClick={() => void postAction('send-for-signature', {}, 'Sent for signature.')}>
                  Send for signature
                </button>
              )}
              {sig?.envelopeId && !allSigned && (
                <button type="button" className="btn btn--ghost" disabled={busy}
                  onClick={() => void postAction('check-signature', {}, 'Signature status updated.')}>
                  Check signature
                </button>
              )}
              {allSigned && (
                <>
                  <input className="procure__search" placeholder="Executed file name"
                    value={completeFileName} onChange={(e) => setCompleteFileName(e.target.value)}
                    style={{ width: '10rem', minWidth: 0 }} />
                  <button type="button" className="btn btn--primary" disabled={busy}
                    onClick={() => void postAction('complete-signature',
                      { fileName: completeFileName.trim() || undefined }, 'Signature completed.')}>
                    Complete signature
                  </button>
                </>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => void transition('cancelled')}>
                Cancel
              </button>
            </>
          )}
          {isActive && (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => void transition('expired')}>
                Expire
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void transition('cancelled')}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="procure__stack">
        {contract.aiExtracted && (
          <div className="procure__notice procure__notice--info">
            Pre-populated by AI from the supplier document. Review extracted fields before sending for
            approval.
          </div>
        )}

        {showApproval && (
          <ApprovalProgress
            chain={CONTRACT_APPROVAL_CHAIN}
            stage={contract.approvalStage || 1}
          />
        )}

        {sig && (
          <div className="procure__card">
            <div className="procure__card-head">
              <div>
                <h2 className="procure__card-title">Signature</h2>
                <p className="procure__card-sub">
                  {sig.status}
                  {sig.envelopeId ? ` · ${sig.envelopeId}` : ''}
                  {sig.sentAt ? ` · sent ${new Date(sig.sentAt).toLocaleString()}` : ''}
                </p>
              </div>
            </div>
            <Kv rows={(sig.signers ?? []).map((s) => ({
              k: `${s.name} (${s.role})`,
              v: `${s.status}${s.signedAt ? ` · ${new Date(s.signedAt).toLocaleString()}` : ''}`,
            }))} />
          </div>
        )}

        <div className="procure__card">
          <div className="procure__card-head">
            <div>
              <h2 className="procure__card-title">Overview</h2>
              <p className="procure__card-sub">Key commercial fields</p>
            </div>
            {canEdit && (
              <button type="button" className="btn btn--ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Close' : 'Edit details'}
              </button>
            )}
          </div>

          {!editing && (
            <Kv rows={[
              { k: 'Vendor', v: dash(contract.vendor?.name) },
              { k: 'Entity', v: dash(contract.entity?.name) },
              { k: 'Agreement type', v: dash(contract.agreementType) },
              { k: 'Value', v: formatMoney(contract.valueMinor, contract.currency) },
              { k: 'Currency', v: contract.currency },
              { k: 'Contract date', v: dash(d(contract.contractDate)) },
              { k: 'Start', v: dash(d(contract.startDate)) },
              { k: 'End', v: dash(d(contract.endDate)) },
              { k: 'Cost center', v: dash(contract.costCenter) },
              { k: 'Owner', v: dash(contract.ownerName) },
              { k: 'CLM tool', v: dash(contract.clmTool) },
              { k: 'Notes', v: dash(contract.notes) },
            ]} />
          )}

          {editing && (
            <form className="workspace-form procure__composer" onSubmit={(e) => void onSave(e)}>
              <label>Title<input name="title" defaultValue={contract.title} required minLength={2} /></label>
              {canPatch && (
                <>
                  <label>Vendor
                    <select name="vendorId" defaultValue={contract.vendorId ?? ''}>
                      <option value="">—</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
                    </select>
                  </label>
                  <label>Entity
                    <select name="entityId" defaultValue={contract.entityId ?? ''}>
                      <option value="">—</option>
                      {entities.map((ent) => <option key={ent.id} value={ent.id}>{ent.code} — {ent.name}</option>)}
                    </select>
                  </label>
                  <label>Currency<input name="currency" defaultValue={contract.currency} maxLength={3} /></label>
                  <label>Agreement type<input name="agreementType" defaultValue={contract.agreementType ?? ''} /></label>
                  <label>Contract date<input name="contractDate" type="date" defaultValue={d(contract.contractDate)} /></label>
                  <label>Cost center<input name="costCenter" defaultValue={contract.costCenter ?? ''} /></label>
                  <label>Owner<input name="ownerName" defaultValue={contract.ownerName ?? ''} /></label>
                  <label>CLM tool
                    <select name="clmTool" defaultValue={contract.clmTool ?? ''}>
                      <option value="">—</option>
                      {CLM_TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>Term type<input name="termType" defaultValue={contract.termType ?? ''} /></label>
                  <label>Notice period<input name="noticePeriod" defaultValue={contract.noticePeriod ?? ''} /></label>
                  <label className="span-2">Purpose<textarea name="purpose" defaultValue={contract.purpose ?? ''} rows={2} /></label>
                  <label className="span-2">Service description
                    <textarea name="serviceDescription" defaultValue={contract.serviceDescription ?? ''} rows={2} />
                  </label>
                </>
              )}
              <label>Start date<input name="startDate" type="date" defaultValue={d(contract.startDate)} /></label>
              <label>End date<input name="endDate" type="date" defaultValue={d(contract.endDate)} /></label>
              <label>Value<input name="value" defaultValue={toMajor(contract.valueMinor)} inputMode="decimal" /></label>
              <label className="span-2">Notes<textarea name="notes" defaultValue={contract.notes ?? ''} rows={2} /></label>
              <div className="span-2 actions">
                <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {isActive ? 'Amend' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {isActive && (
            <div className="procure__actions" style={{ marginTop: '0.85rem' }}>
              <input type="date" className="procure__select" value={renewEndDate}
                onChange={(e) => setRenewEndDate(e.target.value)} />
              <button type="button" className="btn btn--ghost" disabled={!renewEndDate}
                onClick={() => void run(async () => {
                  apply(await apiFetch<Contract>(`/api/contracts/${id}/renew`, {
                    method: 'POST', body: JSON.stringify({ endDate: renewEndDate }),
                  }));
                  setRenewEndDate('');
                }, 'Renewed.', false)}>
                Renew end date
              </button>
            </div>
          )}
        </div>

        <div className="procure__card">
          <h2 className="procure__card-title">Purpose / service / terms</h2>
          <p className="procure__card-sub" style={{ marginBottom: '0.75rem' }}>
            Commercial intent and renewal mechanics
          </p>
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.9rem', lineHeight: 1.5 }}>{dash(contract.purpose)}</p>
          <p className="procure__muted" style={{ margin: '0 0 0.85rem', lineHeight: 1.45 }}>
            {dash(contract.serviceDescription)}
          </p>
          <Kv rows={[
            { k: 'Term type', v: dash(contract.termType) },
            { k: 'Start', v: dash(d(contract.startDate)) },
            { k: 'End', v: dash(d(contract.endDate)) },
            { k: 'Notice', v: dash(contract.noticePeriod) },
          ]} />
        </div>

        <div className="procure__card">
          <div className="procure__card-head">
            <div>
              <h2 className="procure__card-title">Documents</h2>
              <p className="procure__card-sub">Metadata by category (no binary upload)</p>
            </div>
          </div>
          <div className="procure__grid-3">
            {DOC_CATEGORIES.map(({ key, label }) => {
              const docs = (contract.documents ?? []).filter((x) => x.category === key);
              return (
                <div key={key} className="procure__doc">
                  <div className="procure__doc-head">
                    <span>{label}</span>
                    <span className="procure__muted">{docs.length}</span>
                  </div>
                  {docs.length === 0 && <p className="procure__muted">None</p>}
                  {docs.map((doc) => (
                    <div key={doc.id} className="procure__doc-item">
                      <span title={doc.fileName}>{doc.fileName}</span>
                      <button type="button" className="btn btn--ghost" disabled={busy}
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                        onClick={() => void run(async () => {
                          apply(await apiFetch<Contract>(`/api/contracts/${id}/documents/${doc.id}`, {
                            method: 'DELETE',
                          }));
                        }, 'Document removed.')}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="procure__actions" style={{ marginTop: '0.85rem' }}>
            <input className="procure__search" placeholder="File name" value={docFileName}
              onChange={(e) => setDocFileName(e.target.value)} />
            <select className="procure__select" value={docCategory}
              onChange={(e) => setDocCategory(e.target.value)}>
              {DOC_CATEGORIES.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button type="button" className="btn btn--ghost" disabled={busy}
              onClick={() => {
                const fileName = docFileName.trim();
                if (!fileName) { setError('Enter a file name to add a document'); return; }
                void run(async () => {
                  apply(await apiFetch<Contract>(`/api/contracts/${id}/documents`, {
                    method: 'POST', body: JSON.stringify({ category: docCategory, fileName }),
                  }));
                  setDocFileName('');
                }, `Added ${fileName}.`);
              }}>
              + Add
            </button>
          </div>
        </div>

        <div className="procure__card">
          <h2 className="procure__card-title">AI assist</h2>
          <p className="procure__card-sub" style={{ marginBottom: '0.85rem' }}>
            Summarize and scan for risk language
          </p>
          <div className="procure__grid-2">
            <div>
              <button type="button" className="btn btn--ghost" disabled={busy}
                onClick={() => void run(async () => {
                  const result = await apiFetch<{ summary: string }>(
                    `/api/contracts/${id}/ai-summarize`, { method: 'POST', body: JSON.stringify({}) },
                  );
                  setAiSummary(result.summary);
                }, 'AI summary ready.')}>
                Summarize
              </button>
              {aiSummary ? (
                <div className="procure__ai" style={{ marginTop: '0.65rem' }}>
                  <div className="procure__ai-tag">Summary</div>
                  {aiSummary}
                </div>
              ) : (
                <p className="procure__muted" style={{ marginTop: '0.65rem' }}>No summary yet.</p>
              )}
            </div>
            <div>
              <button type="button" className="btn btn--ghost" disabled={busy}
                onClick={() => void run(async () => {
                  const result = await apiFetch<{ redFlags: Flag[]; contract: Contract }>(
                    `/api/contracts/${id}/scan-red-flags`, { method: 'POST', body: JSON.stringify({}) },
                  );
                  setRedFlags(result.redFlags);
                  apply(result.contract);
                  setMessage(`Found ${result.redFlags.length} red flag(s).`);
                })}>
                Scan red flags
              </button>
              <div style={{ marginTop: '0.65rem' }}>
                {redFlags.length === 0 ? (
                  <p className="procure__muted">Not scanned yet.</p>
                ) : (
                  redFlags.map((flag, i) => (
                    <div key={`${flag.severity}-${i}`} className={`procure__flag procure__flag--${flag.severity}`}>
                      <strong>{flag.severity}</strong>
                      <span>{flag.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="procure__card">
          <h2 className="procure__card-title">Comments</h2>
          <div style={{ margin: '0.65rem 0 0.85rem' }}>
            {comments.length === 0 && <p className="procure__muted">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} style={{ marginBottom: '0.55rem', fontSize: '0.86rem' }}>
                <strong>{c.authorName}</strong>
                <span className="procure__muted"> · {new Date(c.createdAt).toLocaleString()}</span>
                <p style={{ margin: '0.2rem 0 0' }}>{c.body}</p>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!commentBody.trim()) return;
            void run(async () => {
              await apiFetch(`/api/contracts/${id}/comments`, {
                method: 'POST', body: JSON.stringify({ body: commentBody }),
              });
              setCommentBody('');
            }, undefined, false);
          }}>
            <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
              rows={2} required placeholder="Add a comment…"
              style={{ width: '100%', marginBottom: '0.5rem' }} />
            <button type="submit" className="btn btn--primary">Post</button>
          </form>
        </div>

        <div className="procure__card">
          <div className="procure__card-head" style={{ marginBottom: activityOpen ? '0.65rem' : 0 }}>
            <div>
              <h2 className="procure__card-title">Activity</h2>
              <p className="procure__card-sub">{activity.length} event(s)</p>
            </div>
            <button type="button" className="btn btn--ghost" onClick={() => setActivityOpen((v) => !v)}>
              {activityOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {activityOpen && (
            <ul className="activity-feed" style={{ margin: 0 }}>
              {activity.length === 0 && <li className="procure__muted">No activity yet.</li>}
              {activity.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <span className="activity-feed__time">{new Date(item.at).toLocaleString()}</span>
                  <span className="activity-feed__actor">{item.actorName ?? 'System'}</span>
                  <p className="activity-feed__body">
                    {item.kind === 'comment'
                      ? item.body
                      : (LABELS[item.action] ?? item.action.replace(/\./g, ' '))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
