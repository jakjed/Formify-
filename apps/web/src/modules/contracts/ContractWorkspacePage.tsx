import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/lib/api';

const APPROVAL_CHAIN = [
  'Budget Owner',
  'Legal',
  'Tax',
  'Compliance',
  'Finance',
] as const;

const CLM_TOOLS = ['Conga', 'Docusign CLM', 'PandaDoc', 'IronClad'] as const;

const DOC_CATEGORIES = [
  ['draft', 'Contract draft'],
  ['executed', 'Executed contract'],
  ['correspondence', 'Correspondence'],
  ['paymentForm', 'Payment Form'],
  ['misc', 'Misc'],
  ['others', 'Others'],
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

type RedFlag = {
  severity: string;
  text: string;
};

type ContractDocument = {
  id: string;
  category: string;
  fileName: string;
  createdAt: string;
};

type Contract = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  valueMinor: number | null;
  vendorId: string | null;
  entityId: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  agreementType: string | null;
  purpose: string | null;
  serviceDescription: string | null;
  costCenter: string | null;
  termType: string | null;
  noticePeriod: string | null;
  clmTool: string | null;
  ownerName: string | null;
  approvalStage: number;
  contractDate: string | null;
  aiExtracted: boolean;
  redFlagsJson: RedFlag[] | null;
  signatureJson: SignatureEnvelope | null;
  documents: ContractDocument[];
  vendor: { id: string; code: string; name: string } | null;
  entity: { id: string; code: string; name: string } | null;
};

type Vendor = { id: string; code: string; name: string };
type Entity = { id: string; code: string; name: string };

type ActivityItem =
  | {
      id: string;
      kind: 'audit';
      at: string;
      actorName: string | null;
      action: string;
    }
  | {
      id: string;
      kind: 'comment';
      at: string;
      actorName: string | null;
      body: string;
    };

type Comment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

function formatAction(action: string) {
  const labels: Record<string, string> = {
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
  return labels[action] ?? action.replace(/\./g, ' ');
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function fromMajor(value: string): number | null {
  if (value.trim() === '') return null;
  return Math.round(parseFloat(value) * 100);
}

function toMajor(minor: number | null): string {
  if (minor == null) return '';
  return (minor / 100).toFixed(2);
}

function readSignature(raw: unknown): SignatureEnvelope | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SignatureEnvelope;
}

function readRedFlags(raw: unknown): RedFlag[] {
  if (!Array.isArray(raw)) return [];
  return raw as RedFlag[];
}

export function ContractWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [docFileName, setDocFileName] = useState<Record<string, string>>({});
  const [completeFileName, setCompleteFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [agreementType, setAgreementType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [termType, setTermType] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [clmTool, setClmTool] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contractDate, setContractDate] = useState('');

  function applyContract(row: Contract) {
    const normalized: Contract = {
      ...row,
      signatureJson: readSignature(row.signatureJson),
      redFlagsJson: readRedFlags(row.redFlagsJson),
      documents: row.documents ?? [],
    };
    setContract(normalized);
    setTitle(normalized.title);
    setVendorId(normalized.vendorId ?? '');
    setEntityId(normalized.entityId ?? '');
    setCurrency(normalized.currency);
    setStartDate(toDateInput(normalized.startDate));
    setEndDate(toDateInput(normalized.endDate));
    setValue(toMajor(normalized.valueMinor));
    setNotes(normalized.notes ?? '');
    setAgreementType(normalized.agreementType ?? '');
    setPurpose(normalized.purpose ?? '');
    setServiceDescription(normalized.serviceDescription ?? '');
    setCostCenter(normalized.costCenter ?? '');
    setTermType(normalized.termType ?? '');
    setNoticePeriod(normalized.noticePeriod ?? '');
    setClmTool(normalized.clmTool ?? '');
    setOwnerName(normalized.ownerName ?? '');
    setContractDate(toDateInput(normalized.contractDate));
    setRedFlags(normalized.redFlagsJson ?? []);
  }

  async function loadSidePanels(contractId: string) {
    const [activityRows, commentRows] = await Promise.all([
      apiFetch<ActivityItem[]>(`/api/contracts/${contractId}/activity`),
      apiFetch<Comment[]>(`/api/contracts/${contractId}/comments`),
    ]);
    setActivity(activityRows);
    setComments(commentRows);
  }

  async function refresh() {
    if (!id) return;
    const [row, vendorRows, entityRows] = await Promise.all([
      apiFetch<Contract>(`/api/contracts/${id}`),
      apiFetch<Vendor[]>('/api/vendors'),
      apiFetch<Entity[]>('/api/entities'),
    ]);
    applyContract(row);
    setVendors(vendorRows);
    setEntities(entityRows);
    await loadSidePanels(id);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id || !contract) return;
    setError(null);
    setMessage(null);
    try {
      const body = {
        title,
        vendorId: vendorId || null,
        entityId: entityId || null,
        currency,
        valueMinor: fromMajor(value),
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes || null,
        agreementType: agreementType || null,
        purpose: purpose || null,
        serviceDescription: serviceDescription || null,
        costCenter: costCenter || null,
        termType: termType || null,
        noticePeriod: noticePeriod || null,
        clmTool: clmTool || null,
        ownerName: ownerName || null,
        contractDate: contractDate || null,
      };
      const row =
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
            });
      applyContract(row);
      setMessage(contract.status === 'active' ? 'Amended.' : 'Saved.');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function transition(status: string) {
    if (!id) return;
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(`/api/contracts/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      applyContract(row);
      setMessage(`Status → ${status}`);
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    }
  }

  async function postAction(
    path: string,
    body?: Record<string, unknown>,
    okMsg?: string,
  ) {
    if (!id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(`/api/contracts/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      applyContract(row);
      setMessage(okMsg ?? 'Done.');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRenew() {
    if (!id || !renewEndDate) return;
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(`/api/contracts/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify({ endDate: renewEndDate }),
      });
      applyContract(row);
      setMessage('Renewed.');
      setRenewEndDate('');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Renew failed');
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault();
    if (!id || !commentBody.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/contracts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody('');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed');
    }
  }

  async function onAiSummarize() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ summary: string }>(
        `/api/contracts/${id}/ai-summarize`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setAiSummary(result.summary);
      setMessage('AI summary ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summarize failed');
    } finally {
      setBusy(false);
    }
  }

  async function onScanRedFlags() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{
        redFlags: RedFlag[];
        contract: Contract;
      }>(`/api/contracts/${id}/scan-red-flags`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setRedFlags(result.redFlags);
      applyContract(result.contract);
      setMessage(`Found ${result.redFlags.length} red flag(s).`);
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function addDocument(category: string) {
    if (!id) return;
    const fileName = (docFileName[category] ?? '').trim();
    if (!fileName) {
      setError('Enter a file name to add a document');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(`/api/contracts/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify({ category, fileName }),
      });
      applyContract(row);
      setDocFileName((m) => ({ ...m, [category]: '' }));
      setMessage(`Added ${fileName}.`);
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add document failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(docId: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await apiFetch<Contract>(
        `/api/contracts/${id}/documents/${docId}`,
        { method: 'DELETE' },
      );
      applyContract(row);
      setMessage('Document removed.');
      await loadSidePanels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  }

  if (!contract) {
    return (
      <section className="page">
        <p className="eyebrow">Procure</p>
        <h1>Contract</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
      </section>
    );
  }

  const locked = contract.status === 'expired' || contract.status === 'cancelled';
  const isActive = contract.status === 'active';
  const canEditFields =
    contract.status === 'draft' || contract.status === 'in_approval';
  const sig = readSignature(contract.signatureJson);
  const allSigned =
    !!sig?.signers?.length && sig.signers.every((s) => s.status === 'Signed');

  return (
    <section className="page">
      <p className="eyebrow">Contract workspace</p>
      <h1>
        {contract.number} · {contract.title}
      </h1>
      <p className="lede">
        Status <strong>{contract.status}</strong>
        {contract.vendor ? ` · ${contract.vendor.name}` : ''}
        {contract.ownerName ? ` · Owner ${contract.ownerName}` : ''}
        {contract.clmTool ? ` · ${contract.clmTool}` : ''}
      </p>

      {contract.aiExtracted && (
        <p className="ok">
          Pre-populated by AI from the supplier document. Review extracted
          fields before sending for approval.
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <h2>Approval progress</h2>
        <p className="muted">
          Internal sign-off only — this does not constitute an official
          signature.
        </p>
        <div className="actions" style={{ flexWrap: 'wrap' }}>
          {APPROVAL_CHAIN.map((label, i) => {
            const stage = i + 1;
            const done = stage < contract.approvalStage;
            const current =
              stage === contract.approvalStage &&
              contract.status === 'in_approval';
            return (
              <span
                key={label}
                className={
                  done || current ? 'status-chip status-chip--amber' : 'muted'
                }
              >
                {done ? '✓ ' : current ? '● ' : `${stage}. `}
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {sig && (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <h2>Signature status</h2>
          <p className="muted">
            {sig.status}
            {sig.envelopeId ? ` · Envelope ${sig.envelopeId}` : ''}
            {sig.sentAt
              ? ` · sent ${new Date(sig.sentAt).toLocaleString()}`
              : ''}
          </p>
          <ul className="task-list">
            {sig.signers.map((s, idx) => (
              <li key={`${s.role}-${idx}`}>
                <div>
                  <strong>
                    {s.name} ({s.role})
                  </strong>
                  <span className="muted">
                    {' '}
                    · {s.status}
                    {s.signedAt
                      ? ` · ${new Date(s.signedAt).toLocaleString()}`
                      : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="workspace-form" onSubmit={(e) => void onSave(e)}>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={locked}
            required
            minLength={2}
          />
        </label>
        <label>
          Vendor
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            disabled={locked || isActive}
          >
            <option value="">— none —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entity
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            disabled={locked || isActive}
          >
            <option value="">— none —</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.code} — {ent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
            disabled={locked || isActive}
          />
        </label>
        <label>
          Agreement type
          <input
            value={agreementType}
            onChange={(e) => setAgreementType(e.target.value)}
            disabled={!canEditFields}
            placeholder="MSA / SOW / NDA"
          />
        </label>
        <label>
          Contract date
          <input
            type="date"
            value={contractDate}
            onChange={(e) => setContractDate(e.target.value)}
            disabled={!canEditFields}
          />
        </label>
        <label>
          Cost center
          <input
            value={costCenter}
            onChange={(e) => setCostCenter(e.target.value)}
            disabled={!canEditFields}
          />
        </label>
        <label>
          Owner
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            disabled={!canEditFields}
          />
        </label>
        <label>
          CLM tool
          <select
            value={clmTool}
            onChange={(e) => setClmTool(e.target.value)}
            disabled={!canEditFields}
          >
            <option value="">— none —</option>
            {CLM_TOOLS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={locked}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={locked}
          />
        </label>
        <label>
          Value
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            disabled={locked}
          />
        </label>
        <label>
          Term type
          <input
            value={termType}
            onChange={(e) => setTermType(e.target.value)}
            disabled={!canEditFields}
            placeholder="Fixed / Auto-renew"
          />
        </label>
        <label>
          Notice period
          <input
            value={noticePeriod}
            onChange={(e) => setNoticePeriod(e.target.value)}
            disabled={!canEditFields}
            placeholder="30 days"
          />
        </label>
        <label className="span-2">
          Purpose
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            disabled={!canEditFields}
          />
        </label>
        <label className="span-2">
          Service description
          <textarea
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
            rows={2}
            disabled={!canEditFields}
          />
        </label>
        <label className="span-2">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={locked}
          />
        </label>

        <div className="span-2 actions">
          {!locked && (canEditFields || isActive) && (
            <button type="submit" disabled={busy}>
              {isActive ? 'Amend' : 'Save'}
            </button>
          )}
          {contract.status === 'draft' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void postAction('send-for-approval', {}, 'Sent for approval.')
                }
              >
                Send for Approval
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          {contract.status === 'in_approval' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void postAction(
                    'advance-approval',
                    {},
                    'Approval advanced.',
                  )
                }
              >
                Approve &amp; advance
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('draft')}
              >
                Send back
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          {contract.status === 'pending_signature' && (
            <>
              {(!sig?.envelopeId || sig.status === 'Not started') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void postAction(
                      'send-for-signature',
                      {},
                      'Sent for signature.',
                    )
                  }
                >
                  Send for Signature
                </button>
              )}
              {sig?.envelopeId && !allSigned && (
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={busy}
                  onClick={() =>
                    void postAction(
                      'check-signature',
                      {},
                      'Signature status updated.',
                    )
                  }
                >
                  Check signature
                </button>
              )}
              {allSigned && (
                <>
                  <input
                    placeholder="Executed file name"
                    value={completeFileName}
                    onChange={(e) => setCompleteFileName(e.target.value)}
                    style={{ width: '10rem' }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void postAction(
                        'complete-signature',
                        {
                          fileName: completeFileName.trim() || undefined,
                        },
                        'Signature completed.',
                      )
                    }
                  >
                    Complete signature
                  </button>
                </>
              )}
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          {isActive && (
            <>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('expired')}
              >
                Expire
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void transition('cancelled')}
              >
                Cancel
              </button>
            </>
          )}
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => void onAiSummarize()}
          >
            Ask AI to summarize
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => void onScanRedFlags()}
          >
            Scan red flags
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate('/contracts')}
          >
            Back to list
          </button>
        </div>
      </form>

      {aiSummary && (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h2>AI summary</h2>
          <p>{aiSummary}</p>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Red flags</h2>
        {redFlags.length === 0 ? (
          <p className="muted">Not scanned yet.</p>
        ) : (
          <ul className="task-list">
            {redFlags.map((f, i) => (
              <li key={`${f.severity}-${i}`}>
                <div>
                  <strong>{f.severity}</strong>
                  <span className="muted"> · {f.text}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Documents</h2>
        <p className="muted">Metadata by category (no binary upload in this build).</p>
        {DOC_CATEGORIES.map(([key, label]) => {
          const docs = (contract.documents ?? []).filter(
            (d) => d.category === key,
          );
          return (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                {label}
              </h3>
              <ul className="task-list">
                {docs.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong>{d.fileName}</strong>
                      <span className="muted">
                        {' '}
                        · {new Date(d.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={busy}
                        onClick={() => void removeDocument(d.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
                {docs.length === 0 && (
                  <li className="muted">No files yet.</li>
                )}
              </ul>
              <div className="actions">
                <input
                  placeholder="file name"
                  value={docFileName[key] ?? ''}
                  onChange={(e) =>
                    setDocFileName((m) => ({ ...m, [key]: e.target.value }))
                  }
                  style={{ width: '12rem' }}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={busy}
                  onClick={() => void addDocument(key)}
                >
                  + Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isActive && (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h2>Renew</h2>
          <div className="actions">
            <input
              type="date"
              value={renewEndDate}
              onChange={(e) => setRenewEndDate(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void onRenew()}
              disabled={!renewEndDate}
            >
              Extend end date
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Activity</h2>
        {activity.length === 0 && <p className="muted">No activity yet.</p>}
        <ul className="activity-feed">
          {activity.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <span className="activity-feed__time">
                {new Date(item.at).toLocaleString()}
              </span>
              <span className="activity-feed__actor">
                {item.actorName ?? 'System'}
              </span>
              {item.kind === 'comment' ? (
                <p className="activity-feed__body">{item.body}</p>
              ) : (
                <p className="activity-feed__body">{formatAction(item.action)}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Comments</h2>
        {comments.length === 0 && <p className="muted">No comments yet.</p>}
        <ul className="task-list">
          {comments.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.authorName}</strong>
                <span className="muted">
                  {' '}
                  · {new Date(c.createdAt).toLocaleString()}
                </span>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <form className="workspace-form" onSubmit={(e) => void onComment(e)}>
          <label className="span-2">
            Add comment
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              required
            />
          </label>
          <div className="span-2 actions">
            <button type="submit">Post</button>
          </div>
        </form>
      </div>

      <p style={{ marginTop: '1rem' }}>
        <Link to="/contracts">← Contracts</Link>
      </p>
    </section>
  );
}
