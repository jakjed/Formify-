import {
  DragEvent,
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, apiFetchBlob } from '../../shared/lib/api';

type Invoice = {
  id: string;
  status: string;
  invoiceNumber: string | null;
  vendorNameRaw: string | null;
  vendorId: string | null;
  purchaseOrderId: string | null;
  currency: string;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  notes: string | null;
  ocrConfidence: number | null;
  ocrPayload: OcrPayload | null;
  fileAsset: { originalName: string; mimeType: string } | null;
  purchaseOrder: {
    id: string;
    number: string;
    title: string;
    status: string;
    totalMinor: number | null;
  } | null;
  lines: {
    id: string;
    lineNo: number;
    description: string | null;
    quantity: number | null;
    unitPriceMinor: number | null;
    amountMinor: number | null;
  }[];
  exceptions: { id: string; code: string; message: string; resolved: boolean }[];
};

type OcrBBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  page: number;
};

type OcrFieldHit = {
  id: string;
  key: string;
  label: string;
  text: string;
  confidence: number | null;
  bbox: OcrBBox | null;
};

type OcrPayload = {
  version: 1;
  provider: 'stub' | 'textract';
  extractedAt: string;
  fields: OcrFieldHit[];
};

type Vendor = { id: string; code: string; name: string };
type PoOption = {
  id: string;
  number: string;
  title: string;
  status: string;
  totalMinor: number | null;
};

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

type OcrChip = {
  id: string;
  label: string;
  value: string;
  bbox: OcrBBox | null;
};

type FieldKey =
  | 'invoiceNumber'
  | 'vendorNameRaw'
  | 'currency'
  | 'invoiceDate'
  | 'dueDate'
  | 'subtotal'
  | 'tax'
  | 'total'
  | 'notes';

const OCR_MIME = 'application/x-aptora-ocr';

function isOcrPayload(value: unknown): value is OcrPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as OcrPayload;
  return v.version === 1 && Array.isArray(v.fields);
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    'invoice.updated': 'Updated invoice fields',
    'invoice.uploaded': 'Uploaded document',
    'invoice.captured_email': 'Captured via email',
    'invoice.submitted': 'Submitted for approval',
    'invoice.approved': 'Approved',
    'invoice.rejected': 'Rejected',
    'invoice.voided': 'Voided',
    'invoice.exceptions_resolved': 'Resolved exceptions',
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

function buildOcrChips(invoice: Invoice): OcrChip[] {
  if (isOcrPayload(invoice.ocrPayload) && invoice.ocrPayload.fields.length > 0) {
    return invoice.ocrPayload.fields
      .filter((f) => f.text?.trim())
      .map((f) => ({
        id: f.id,
        label: f.label,
        value: f.text.trim(),
        bbox: f.bbox,
      }));
  }

  const chips: OcrChip[] = [];
  const push = (id: string, label: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (!v) return;
    chips.push({ id, label, value: v, bbox: null });
  };

  push('vendor', 'Vendor', invoice.vendorNameRaw);
  push('number', 'Invoice #', invoice.invoiceNumber);
  push('date', 'Invoice date', toDateInput(invoice.invoiceDate));
  push('due', 'Due date', toDateInput(invoice.dueDate));
  push('currency', 'Currency', invoice.currency);
  push('subtotal', 'Subtotal', toMajor(invoice.subtotalMinor));
  push('tax', 'Tax', toMajor(invoice.taxMinor));
  push('total', 'Total', toMajor(invoice.totalMinor));

  for (const line of invoice.lines) {
    push(`line-${line.id}-desc`, `Line ${line.lineNo}`, line.description);
    if (line.quantity != null) {
      push(`line-${line.id}-qty`, `Qty ${line.lineNo}`, String(line.quantity));
    }
    push(
      `line-${line.id}-amt`,
      `Amount ${line.lineNo}`,
      toMajor(line.amountMinor),
    );
  }

  return chips;
}

function GeometryOverlays({
  chips,
  armedId,
  onDragStart,
  onDragEnd,
  onClick,
  mode,
}: {
  chips: OcrChip[];
  armedId: string | null;
  onDragStart: (e: DragEvent, chip: OcrChip) => void;
  onDragEnd: () => void;
  onClick: (chip: OcrChip) => void;
  mode: 'image' | 'map';
}) {
  const withBox = chips.filter((c) => c.bbox);
  if (withBox.length === 0) return null;

  return (
    <div
      className={`hitl-geom hitl-geom--${mode}`}
      aria-label="OCR regions on document"
    >
      {withBox.map((chip) => {
        const b = chip.bbox!;
        return (
          <button
            key={chip.id}
            type="button"
            className={`hitl-bbox${armedId === chip.id ? ' hitl-bbox--armed' : ''}`}
            style={{
              left: `${b.left * 100}%`,
              top: `${b.top * 100}%`,
              width: `${Math.max(b.width * 100, 4)}%`,
              height: `${Math.max(b.height * 100, 2.5)}%`,
            }}
            title={`${chip.label}: ${chip.value}`}
            draggable
            onDragStart={(e) => onDragStart(e, chip)}
            onDragEnd={onDragEnd}
            onClick={() => onClick(chip)}
          >
            <span className="hitl-bbox__label">{chip.label}</span>
            <span className="hitl-bbox__value">{chip.value}</span>
          </button>
        );
      })}
    </div>
  );
}

function DocumentViewer({
  invoiceId,
  fileAsset,
  chips,
  armedId,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  invoiceId: string;
  fileAsset: { originalName: string; mimeType: string } | null;
  chips: OcrChip[];
  armedId: string | null;
  onDragStart: (e: DragEvent, chip: OcrChip) => void;
  onDragEnd: () => void;
  onClick: (chip: OcrChip) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasGeometry = chips.some((c) => c.bbox);

  useEffect(() => {
    if (!fileAsset) {
      setUrl(null);
      setTextPreview(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const blob = await apiFetchBlob(`/api/invoices/${invoiceId}/file`);
        if (cancelled) return;
        const mime = fileAsset.mimeType || blob.type;
        if (
          mime.startsWith('text/') ||
          fileAsset.originalName.toLowerCase().endsWith('.txt')
        ) {
          const text = await blob.text();
          if (!cancelled) setTextPreview(text);
        } else {
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Preview failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId, fileAsset]);

  if (!fileAsset) {
    return (
      <div className="hitl-doc__empty">
        <p>No scanned document attached to this invoice.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="hitl-doc__empty">
        <p>Loading scan…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hitl-doc__empty">
        <p className="error">{error}</p>
      </div>
    );
  }

  const mime = fileAsset.mimeType;
  const isImage = mime.startsWith('image/');
  const isPdf =
    mime === 'application/pdf' ||
    fileAsset.originalName.toLowerCase().endsWith('.pdf');

  return (
    <div className="hitl-doc__stack">
      <div className="hitl-doc__canvas">
        {textPreview != null && (
          <div className="hitl-doc__text-wrap">
            <pre className="hitl-doc__text" aria-label="Scanned document text">
              {textPreview}
            </pre>
            {hasGeometry && (
              <GeometryOverlays
                chips={chips}
                armedId={armedId}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onClick}
                mode="image"
              />
            )}
          </div>
        )}
        {url && isImage && (
          <div className="hitl-doc__image-wrap">
            <img
              className="hitl-doc__image"
              src={url}
              alt={`Scan of ${fileAsset.originalName}`}
              draggable={false}
            />
            {hasGeometry && (
              <GeometryOverlays
                chips={chips}
                armedId={armedId}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onClick}
                mode="image"
              />
            )}
          </div>
        )}
        {url && isPdf && (
          <iframe
            className="hitl-doc__frame"
            title={fileAsset.originalName}
            src={url}
          />
        )}
        {url && !isImage && !isPdf && (
          <div className="hitl-doc__empty">
            <p>Preview not available for this file type.</p>
            <a href={url} download={fileAsset.originalName}>
              Download {fileAsset.originalName}
            </a>
          </div>
        )}
      </div>

      {url && isPdf && hasGeometry && (
        <div className="hitl-geom-map-panel">
          <h3>Detected regions</h3>
          <p className="muted">
            Drag a region onto a form field (PDF preview cannot host overlays).
          </p>
          <div className="hitl-geom-map-page">
            <GeometryOverlays
              chips={chips}
              armedId={armedId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={onClick}
              mode="map"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DropField({
  label,
  fieldKey,
  children,
  dropActive,
  onDropValue,
}: {
  label: string;
  fieldKey: FieldKey;
  children: ReactNode;
  dropActive: boolean;
  onDropValue: (field: FieldKey, value: string) => void;
}) {
  function onDragOver(e: DragEvent) {
    if (![...e.dataTransfer.types].includes(OCR_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const value = e.dataTransfer.getData(OCR_MIME) || e.dataTransfer.getData('text/plain');
    if (value) onDropValue(fieldKey, value);
  }

  return (
    <label
      className={`hitl-field${dropActive ? ' hitl-field--drop' : ''}`}
      data-field={fieldKey}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="hitl-field__label">{label}</span>
      {children}
    </label>
  );
}

export function InvoiceWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PoOption[]>([]);
  const [poLicensed, setPoLicensed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    { code: string; message: string; blocking: boolean }[]
  >([]);
  const [duplicateOfId, setDuplicateOfId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [dragging, setDragging] = useState(false);
  const [armedChip, setArmedChip] = useState<OcrChip | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorNameRaw, setVendorNameRaw] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');

  const chips = useMemo(
    () => (invoice ? buildOcrChips(invoice) : []),
    [invoice],
  );

  async function loadSidePanels(invoiceId: string) {
    const [validation, activityRows, commentRows] = await Promise.all([
      apiFetch<{
        issues: { code: string; message: string; blocking: boolean }[];
        duplicateOfId: string | null;
        blocking: boolean;
        invoice: Invoice;
      }>(`/api/invoices/${invoiceId}/validation`),
      apiFetch<ActivityItem[]>(`/api/invoices/${invoiceId}/activity`),
      apiFetch<Comment[]>(`/api/invoices/${invoiceId}/comments`),
    ]);
    setValidationIssues(validation.issues);
    setDuplicateOfId(validation.duplicateOfId);
    setInvoice(validation.invoice);
    setActivity(activityRows);
    setComments(commentRows);
    return validation;
  }

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [validation, vendorList, modules] = await Promise.all([
          loadSidePanels(id),
          apiFetch<Vendor[]>('/api/vendors'),
          apiFetch<{ moduleKey: string; enabled: boolean }[]>(
            '/api/modules',
          ).catch(() => [] as { moduleKey: string; enabled: boolean }[]),
        ]);
        setVendors(vendorList);
        const ordersOn = modules.some(
          (m) => m.moduleKey === 'purchase_orders' && m.enabled,
        );
        setPoLicensed(ordersOn);
        if (ordersOn) {
          const pos = await apiFetch<PoOption[]>('/api/purchase-orders').catch(
            () => [] as PoOption[],
          );
          setPurchaseOrders(pos);
        }
        const current = validation.invoice;
        setInvoiceNumber(current.invoiceNumber ?? '');
        setVendorNameRaw(current.vendorNameRaw ?? '');
        setVendorId(current.vendorId ?? '');
        setCurrency(current.currency);
        setInvoiceDate(toDateInput(current.invoiceDate));
        setDueDate(toDateInput(current.dueDate));
        setSubtotal(toMajor(current.subtotalMinor));
        setTax(toMajor(current.taxMinor));
        setTotal(toMajor(current.totalMinor));
        setNotes(current.notes ?? '');
        setPurchaseOrderId(current.purchaseOrderId ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
  }, [id]);

  function applyChipValue(field: FieldKey, value: string) {
    switch (field) {
      case 'invoiceNumber':
        setInvoiceNumber(value);
        break;
      case 'vendorNameRaw':
        setVendorNameRaw(value);
        break;
      case 'currency':
        setCurrency(value.slice(0, 3).toUpperCase());
        break;
      case 'invoiceDate':
        setInvoiceDate(value.slice(0, 10));
        break;
      case 'dueDate':
        setDueDate(value.slice(0, 10));
        break;
      case 'subtotal':
        setSubtotal(value);
        break;
      case 'tax':
        setTax(value);
        break;
      case 'total':
        setTotal(value);
        break;
      case 'notes':
        setNotes((prev) => (prev ? `${prev}\n${value}` : value));
        break;
      default:
        break;
    }
    setArmedChip(null);
    setMessage(`Applied “${value}” to ${field}`);
  }

  function clearArmedOnEdit() {
    if (armedChip) setArmedChip(null);
  }

  function onChipDragStart(e: DragEvent, chip: OcrChip) {
    e.dataTransfer.setData(OCR_MIME, chip.value);
    e.dataTransfer.setData('text/plain', chip.value);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
    setArmedChip(chip);
  }

  function onChipDragEnd() {
    setDragging(false);
  }

  function onChipClick(chip: OcrChip) {
    setArmedChip((prev) => (prev?.id === chip.id ? null : chip));
  }

  function onFieldFocus(field: FieldKey) {
    if (armedChip) applyChipValue(field, armedChip.value);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setMessage(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          invoiceNumber: invoiceNumber || null,
          vendorNameRaw: vendorNameRaw || null,
          vendorId: vendorId || null,
          currency,
          invoiceDate: invoiceDate || null,
          dueDate: dueDate || null,
          subtotalMinor: fromMajor(subtotal),
          taxMinor: fromMajor(tax),
          totalMinor: fromMajor(total),
          notes: notes || null,
          purchaseOrderId: purchaseOrderId || null,
        }),
      });
      setInvoice(inv);
      const validation = await loadSidePanels(id);
      setMessage(
        validation.blocking
          ? 'Saved — blocking validation issues remain'
          : 'Saved — ready to submit',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function onApprove() {
    if (!id) return;
    setError(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}/approve`, {
        method: 'POST',
      });
      setInvoice(inv);
      setMessage('Force-approved — billable transaction recorded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  async function onSubmit() {
    if (!id) return;
    setError(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}/submit`, {
        method: 'POST',
      });
      setInvoice(inv);
      setMessage(
        inv.status === 'approved'
          ? 'Auto-approved by policy'
          : 'Submitted for approval',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  }

  async function onResolve() {
    if (!id) return;
    const inv = await apiFetch<Invoice>(`/api/invoices/${id}/resolve-exceptions`, {
      method: 'POST',
    });
    setInvoice(inv);
    await loadSidePanels(id);
    setMessage('Exceptions marked resolved');
  }

  async function onAddComment(e: FormEvent) {
    e.preventDefault();
    if (!id || !commentBody.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/invoices/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      setCommentBody('');
      await loadSidePanels(id);
      setMessage('Comment added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed');
    }
  }

  if (!invoice && !error) {
    return (
      <section className="page page--hitl">
        <p>Loading workspace…</p>
      </section>
    );
  }
  if (!invoice) {
    return (
      <section className="page page--hitl">
        <p className="error">{error}</p>
        <Link to="/invoices">Back</Link>
      </section>
    );
  }

  return (
    <section className="page page--hitl">
      <header className="hitl-header">
        <div>
          <p className="eyebrow">Document review</p>
          <h1>{invoice.invoiceNumber ?? 'Draft invoice'}</h1>
          <p className="lede hitl-header__meta">
            <span className={`hitl-status hitl-status--${invoice.status}`}>
              {invoice.status}
            </span>
            {invoice.ocrConfidence != null && (
              <span>
                OCR {(invoice.ocrConfidence * 100).toFixed(0)}%
              </span>
            )}
            {invoice.fileAsset && <span>{invoice.fileAsset.originalName}</span>}
          </p>
        </div>
        <div className="hitl-header__actions">
          <button type="button" className="secondary-btn" onClick={() => navigate('/invoices')}>
            Back
          </button>
          <button type="button" onClick={() => void onSubmit()}>
            Submit
          </button>
          <button
            type="button"
            onClick={() => void onApprove()}
            disabled={invoice.status === 'approved' || invoice.status === 'exported'}
          >
            Force approve
          </button>
        </div>
      </header>

      <div className={`hitl-split${dragging ? ' hitl-split--dragging' : ''}`}>
        <aside className="hitl-doc" aria-label="Original scanned document">
          <div className="hitl-doc__toolbar">
            <h2>Original scan</h2>
            <p>
              Drag a highlighted region (or chip) onto a form field
              {armedChip ? (
                <>
                  {' '}
                  · armed: <strong>{armedChip.label}</strong>
                </>
              ) : (
                <> · or click a region, then click a field</>
              )}
            </p>
          </div>

          <DocumentViewer
            invoiceId={invoice.id}
            fileAsset={invoice.fileAsset}
            chips={chips}
            armedId={armedChip?.id ?? null}
            onDragStart={onChipDragStart}
            onDragEnd={onChipDragEnd}
            onClick={onChipClick}
          />

          <div className="hitl-chips" aria-label="Recognized OCR values">
            <h3>Recognized values</h3>
            {chips.length === 0 ? (
              <p className="muted">No extracted values yet — type or wait for OCR.</p>
            ) : (
              <ul>
                {chips.map((chip) => (
                  <li key={chip.id}>
                    <button
                      type="button"
                      className={`hitl-chip${armedChip?.id === chip.id ? ' hitl-chip--armed' : ''}${chip.bbox ? ' hitl-chip--geo' : ''}`}
                      draggable
                      onDragStart={(e) => onChipDragStart(e, chip)}
                      onDragEnd={onChipDragEnd}
                      onClick={() => onChipClick(chip)}
                      title={
                        chip.bbox
                          ? 'Drag from chip or document region onto a field'
                          : 'Drag onto a field, or click then click a field'
                      }
                    >
                      <span className="hitl-chip__label">{chip.label}</span>
                      <span className="hitl-chip__value">{chip.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="hitl-editor">
          {invoice.exceptions.some((x) => !x.resolved) && (
            <div className="hitl-alert">
              <h2>Exceptions</h2>
              <ul>
                {invoice.exceptions
                  .filter((x) => !x.resolved)
                  .map((x) => (
                    <li key={x.id}>
                      <strong>{x.code}</strong> — {x.message}
                    </li>
                  ))}
              </ul>
              {duplicateOfId && (
                <p className="error">
                  Duplicate of{' '}
                  <Link to={`/invoices/${duplicateOfId}`}>open original</Link>
                </p>
              )}
              <button type="button" className="secondary-btn" onClick={() => void onResolve()}>
                Mark exceptions resolved
              </button>
            </div>
          )}

          {validationIssues.length > 0 &&
            !invoice.exceptions.some((x) => !x.resolved) && (
              <div className="hitl-alert hitl-alert--soft">
                <h2>Validation</h2>
                <ul>
                  {validationIssues.map((x) => (
                    <li key={`${x.code}-${x.message}`}>
                      <strong>{x.code}</strong> — {x.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <form className="workspace-form hitl-form" onSubmit={onSave}>
            <DropField
              label="Invoice number"
              fieldKey="invoiceNumber"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                value={invoiceNumber}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setInvoiceNumber(e.target.value);
                }}
                onFocus={() => onFieldFocus('invoiceNumber')}
              />
            </DropField>
            <DropField
              label="Vendor (raw)"
              fieldKey="vendorNameRaw"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                value={vendorNameRaw}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setVendorNameRaw(e.target.value);
                }}
                onFocus={() => onFieldFocus('vendorNameRaw')}
              />
            </DropField>
            <label className="hitl-field">
              <span className="hitl-field__label">Vendor master</span>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">— none —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
            </label>
            {poLicensed && (
              <label className="hitl-field">
                <span className="hitl-field__label">Purchase order</span>
                <select
                  value={purchaseOrderId}
                  onChange={(e) => setPurchaseOrderId(e.target.value)}
                >
                  <option value="">— none —</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.number} — {po.title} ({po.status})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <DropField
              label="Currency"
              fieldKey="currency"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                value={currency}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setCurrency(e.target.value);
                }}
                maxLength={3}
                onFocus={() => onFieldFocus('currency')}
              />
            </DropField>
            <DropField
              label="Invoice date"
              fieldKey="invoiceDate"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setInvoiceDate(e.target.value);
                }}
                onFocus={() => onFieldFocus('invoiceDate')}
              />
            </DropField>
            <DropField
              label="Due date"
              fieldKey="dueDate"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setDueDate(e.target.value);
                }}
                onFocus={() => onFieldFocus('dueDate')}
              />
            </DropField>
            <DropField
              label="Subtotal"
              fieldKey="subtotal"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                value={subtotal}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setSubtotal(e.target.value);
                }}
                inputMode="decimal"
                onFocus={() => onFieldFocus('subtotal')}
              />
            </DropField>
            <DropField
              label="Tax"
              fieldKey="tax"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                value={tax}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setTax(e.target.value);
                }}
                inputMode="decimal"
                onFocus={() => onFieldFocus('tax')}
              />
            </DropField>
            <DropField
              label="Total"
              fieldKey="total"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <input
                value={total}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setTotal(e.target.value);
                }}
                inputMode="decimal"
                required
                onFocus={() => onFieldFocus('total')}
              />
            </DropField>
            <DropField
              label="Notes"
              fieldKey="notes"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
            >
              <textarea
                value={notes}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setNotes(e.target.value);
                }}
                rows={3}
                onFocus={() => onFieldFocus('notes')}
              />
            </DropField>

            {error && <p className="error span-2">{error}</p>}
            {message && <p className="ok span-2">{message}</p>}

            <div className="span-2 actions">
              <button type="submit">Save fields</button>
            </div>
          </form>

          <div className="hitl-sidepanel">
            <h2>Lines</h2>
            <ul className="hitl-lines">
              {invoice.lines.map((line) => (
                <li key={line.id}>
                  <span>#{line.lineNo}</span>
                  <span>{line.description ?? '—'}</span>
                  <span>
                    {line.amountMinor != null
                      ? (line.amountMinor / 100).toFixed(2)
                      : '—'}
                  </span>
                </li>
              ))}
              {invoice.lines.length === 0 && (
                <li className="muted">No line items extracted.</li>
              )}
            </ul>
          </div>

          <div className="hitl-sidepanel">
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

          <div className="hitl-sidepanel">
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
            <form className="inline-form" onSubmit={(e) => void onAddComment(e)}>
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                required
                style={{ flex: 1, minWidth: '12rem' }}
              />
              <button type="submit">Post</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
