import {
  DragEvent,
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CURRENCY_CODES } from '@aptora/types';
import { apiFetch, apiFetchBlob, getToken } from '../../shared/lib/api';
import { FileSelect } from '../../shared/components/FileSelect';
import { InvoiceStatusBadge, StatusBadge } from '../../shared/ui/StatusBadge';
import { ocrConfidenceTone } from '../../shared/ui/status';
import { bestVendorMatch } from '../../shared/ui/vendorMatch';

type InvoiceLine = {
  id?: string;
  lineNo: number;
  description: string | null;
  quantity: number | null;
  unitPriceMinor: number | null;
  amountMinor: number | null;
  taxMinor: number | null;
  taxCodeId: string | null;
  glAccountId: string | null;
  costCenterId: string | null;
  categoryId: string | null;
  purchaseOrderLineId: string | null;
};

type Invoice = {
  id: string;
  status: string;
  entityId: string | null;
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
  lines: InvoiceLine[];
  attachments?: {
    id: string;
    label: string | null;
    fileAsset: {
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    };
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
type CodeName = { id: string; code: string; name: string; active?: boolean };
type TaxCode = CodeName & { rateBps: number };
type ExpenseCategory = CodeName & {
  entityId: string;
  glAccountId: string;
};
type PoLineOption = {
  id: string;
  lineNo: number;
  description: string | null;
  amountMinor: number | null;
};

function mapEditLines(lines: InvoiceLine[]): InvoiceLine[] {
  return lines.map((line) => ({
    id: line.id,
    lineNo: line.lineNo,
    description: line.description ?? null,
    quantity: line.quantity ?? null,
    unitPriceMinor: line.unitPriceMinor ?? null,
    amountMinor: line.amountMinor ?? null,
    taxMinor: line.taxMinor ?? null,
    taxCodeId: line.taxCodeId ?? null,
    glAccountId: line.glAccountId ?? null,
    costCenterId: line.costCenterId ?? null,
    categoryId: line.categoryId ?? null,
    purchaseOrderLineId: line.purchaseOrderLineId ?? null,
  }));
}

function lineDraftsFromLines(lines: InvoiceLine[]) {
  return {
    amounts: lines.map((line) =>
      line.amountMinor != null ? toMajor(line.amountMinor) : '',
    ),
    qtys: lines.map((line) =>
      line.quantity != null ? String(line.quantity) : '',
    ),
  };
}

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
  confidence: number | null;
  key?: string;
};

const HIGH_CONF = 0.85;

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
        confidence: f.confidence,
        key: f.key,
      }));
  }

  const chips: OcrChip[] = [];
  const push = (id: string, label: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (!v) return;
    chips.push({ id, label, value: v, bbox: null, confidence: null });
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
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
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
  const isText = textPreview != null;
  /** Image uses real Textract/stub coords on the bitmap; text/PDF use a map. */
  const showMap = hasGeometry && (isPdf || isText);

  return (
    <div className="hitl-doc__stack">
      <div className="hitl-doc__zoom">
        <button type="button" className="btn btn--ghost" onClick={() => setZoom((z) => Math.max(50, z - 25))}>
          −
        </button>
        <span>{zoom}%</span>
        <button type="button" className="btn btn--ghost" onClick={() => setZoom((z) => Math.min(200, z + 25))}>
          +
        </button>
        {isPdf && (
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev page
            </button>
            <span>Page {page}</span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPage((p) => p + 1)}
            >
              Next page
            </button>
          </>
        )}
      </div>
      <div className="hitl-doc__canvas" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
        {textPreview != null && (
          <pre className="hitl-doc__text" aria-label="Scanned document text">
            {textPreview}
          </pre>
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
            src={`${url}#toolbar=1&navpanes=0&page=${page}&zoom=${zoom}`}
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

      {showMap && (
        <div className="hitl-geom-map-panel">
          <h3>Detected regions</h3>
          <p className="muted">
            Drag a region onto a form field
            {isPdf
              ? ' (PDF preview cannot host overlays).'
              : ' — mapped from OCR geometry.'}
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
  confidence,
}: {
  label: string;
  fieldKey: FieldKey;
  children: ReactNode;
  dropActive: boolean;
  onDropValue: (field: FieldKey, value: string) => void;
  confidence?: number | null;
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

  const high = confidence != null && confidence >= HIGH_CONF;
  return (
    <label
      className={`hitl-field${dropActive ? ' hitl-field--drop' : ''}${high ? ' hitl-field--high' : ''}`}
      data-field={fieldKey}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="hitl-field__label">
        {label}
        {confidence != null && (
          <span
            className={
              confidence >= HIGH_CONF
                ? 'hitl-conf hitl-conf--ok'
                : 'hitl-conf hitl-conf--low'
            }
          >
            {confidence >= HIGH_CONF ? '✓' : `${Math.round(confidence * 100)}%`}
          </span>
        )}
      </span>
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
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [glAccounts, setGlAccounts] = useState<CodeName[]>([]);
  const [costCenters, setCostCenters] = useState<CodeName[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [poLines, setPoLines] = useState<PoLineOption[]>([]);
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
  const [vendorMatchHint, setVendorMatchHint] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<InvoiceLine[]>([]);
  const [lineAmountDrafts, setLineAmountDrafts] = useState<string[]>([]);
  const [lineQtyDrafts, setLineQtyDrafts] = useState<string[]>([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachLabel, setAttachLabel] = useState('');
  const [attachInputKey, setAttachInputKey] = useState(0);
  const [matchPanel, setMatchPanel] = useState<{
    linked: boolean;
    invoice: { totalMinor: number | null; vendorName: string | null };
    po: { number: string; status: string; totalMinor: number | null } | null;
    lines: {
      invoiceLineNo: number;
      invoiceDesc: string | null;
      invoiceAmountMinor: number | null;
      poLineNo: number | null;
      poAmountMinor: number | null;
      state: string;
    }[];
    issues: { code: string; message: string }[];
  } | null>(null);
  const [vendor360, setVendor360] = useState<{
    vendor: { name: string; code: string };
    spendMinor: number;
    openExceptions: number;
    invoices: { id: string; invoiceNumber: string | null; status: string; totalMinor: number | null }[];
    lastCoding: { glAccountId: string | null }[];
  } | null>(null);
  const [codingSuggest, setCodingSuggest] = useState<{
    sourceNumber: string | null;
    lines: {
      glAccountId: string | null;
      costCenterId: string | null;
      categoryId: string | null;
      taxCodeId: string | null;
    }[];
  } | null>(null);

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

  function fieldConf(key: string) {
    return chips.find((c) => c.key === key || c.id === key)?.confidence ?? null;
  }

  const filteredCategories = useMemo(() => {
    if (!invoice?.entityId) return categories;
    return categories.filter((c) => c.entityId === invoice.entityId);
  }, [categories, invoice?.entityId]);

  function tryVendorMatch(raw: string, vendorList: Vendor[], currentVendorId: string) {
    if (currentVendorId) return;
    if (!raw.trim()) {
      setVendorMatchHint(null);
      return;
    }
    const hit = bestVendorMatch(raw, vendorList);
    if (hit) {
      setVendorId(hit.id);
      setVendorMatchHint(hit.name);
    } else {
      setVendorMatchHint(null);
    }
  }

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
    void apiFetch<typeof matchPanel>(`/api/invoices/${invoiceId}/match`)
      .then(setMatchPanel)
      .catch(() => undefined);
    return validation;
  }

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [
          validation,
          vendorList,
          modules,
          taxList,
          glList,
          ccList,
          catList,
        ] = await Promise.all([
          loadSidePanels(id),
          apiFetch<Vendor[]>('/api/vendors'),
          apiFetch<{ moduleKey: string; enabled: boolean }[]>(
            '/api/modules',
          ).catch(() => [] as { moduleKey: string; enabled: boolean }[]),
          apiFetch<TaxCode[]>('/api/tax-codes').catch(() => [] as TaxCode[]),
          apiFetch<CodeName[]>('/api/gl-accounts?accountType=expense').catch(
            () => [] as CodeName[],
          ),
          apiFetch<CodeName[]>('/api/cost-centers').catch(
            () => [] as CodeName[],
          ),
          apiFetch<ExpenseCategory[]>('/api/expense-categories').catch(
            () => [] as ExpenseCategory[],
          ),
        ]);
        setVendors(vendorList);
        setTaxCodes(taxList);
        setGlAccounts(glList);
        setCostCenters(ccList);
        setCategories(catList);
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
        const mappedLines = mapEditLines(current.lines ?? []);
        setEditLines(mappedLines);
        const drafts = lineDraftsFromLines(mappedLines);
        setLineAmountDrafts(drafts.amounts);
        setLineQtyDrafts(drafts.qtys);
        if (!current.vendorId && current.vendorNameRaw) {
          tryVendorMatch(current.vendorNameRaw, vendorList, '');
        } else {
          setVendorMatchHint(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!purchaseOrderId) {
      setPoLines([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const po = await apiFetch<{ lines: PoLineOption[] }>(
          `/api/purchase-orders/${purchaseOrderId}`,
        );
        if (!cancelled) setPoLines(po.lines ?? []);
      } catch {
        if (!cancelled) setPoLines([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseOrderId]);

  useEffect(() => {
    if (!vendorId) {
      setVendor360(null);
      setCodingSuggest(null);
      return;
    }
    void apiFetch<NonNullable<typeof vendor360>>(
      `/api/invoices/vendor-360/${vendorId}`,
    )
      .then(setVendor360)
      .catch(() => setVendor360(null));
    void apiFetch<NonNullable<typeof codingSuggest>>(
      `/api/invoices/coding-suggest?vendorId=${vendorId}`,
    )
      .then(setCodingSuggest)
      .catch(() => setCodingSuggest(null));
  }, [vendorId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        void goNext();
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        void onApprove();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void onReject();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function applyChipValue(field: FieldKey, value: string) {
    switch (field) {
      case 'invoiceNumber':
        setInvoiceNumber(value);
        break;
      case 'vendorNameRaw':
        setVendorNameRaw(value);
        tryVendorMatch(value, vendors, vendorId);
        break;
      case 'currency': {
        const code = value.slice(0, 3).toUpperCase();
        setCurrency(
          (CURRENCY_CODES as readonly string[]).includes(code) ? code : currency,
        );
        break;
      }
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

  function updateEditLine(index: number, patch: Partial<InvoiceLine>) {
    setEditLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function onTaxCodeChange(index: number, taxCodeId: string) {
    const line = editLines[index];
    if (!line) return;
    const code = taxCodes.find((t) => t.id === taxCodeId);
    const amount = line.amountMinor;
    const taxMinor =
      code && amount != null
        ? Math.round((amount * code.rateBps) / 10_000)
        : line.taxMinor;
    updateEditLine(index, {
      taxCodeId: taxCodeId || null,
      taxMinor: taxCodeId ? taxMinor : null,
    });
  }

  function onCategoryChange(index: number, categoryId: string) {
    const cat = filteredCategories.find((c) => c.id === categoryId);
    updateEditLine(index, {
      categoryId: categoryId || null,
      ...(cat ? { glAccountId: cat.glAccountId } : {}),
    });
  }

  function onAmountChange(index: number, major: string) {
    setLineAmountDrafts((prev) =>
      prev.map((value, i) => (i === index ? major : value)),
    );
    const amountMinor = fromMajor(major);
    const line = editLines[index];
    if (!line) return;
    const code = line.taxCodeId
      ? taxCodes.find((t) => t.id === line.taxCodeId)
      : undefined;
    const taxMinor =
      code && amountMinor != null
        ? Math.round((amountMinor * code.rateBps) / 10_000)
        : line.taxMinor;
    updateEditLine(index, {
      amountMinor,
      ...(code ? { taxMinor } : {}),
    });
  }

  function onQtyChange(index: number, raw: string) {
    setLineQtyDrafts((prev) =>
      prev.map((value, i) => (i === index ? raw : value)),
    );
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    updateEditLine(index, {
      quantity:
        parsed != null && Number.isFinite(parsed) ? parsed : null,
    });
  }

  function addEditLine() {
    setEditLines((prev) => [
      ...prev,
      {
        lineNo: prev.length + 1,
        description: null,
        quantity: null,
        unitPriceMinor: null,
        amountMinor: null,
        taxMinor: null,
        taxCodeId: null,
        glAccountId: null,
        costCenterId: null,
        categoryId: null,
        purchaseOrderLineId: null,
      },
    ]);
    setLineAmountDrafts((prev) => [...prev, '']);
    setLineQtyDrafts((prev) => [...prev, '']);
  }

  function removeEditLine(index: number) {
    setEditLines((prev) => prev.filter((_, i) => i !== index));
    setLineAmountDrafts((prev) => prev.filter((_, i) => i !== index));
    setLineQtyDrafts((prev) => prev.filter((_, i) => i !== index));
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
          lines: editLines.map((line, i) => ({
            id: line.id,
            lineNo: i + 1,
            description: line.description,
            quantity: (() => {
              const raw = (lineQtyDrafts[i] ?? '').trim();
              if (raw === '') return null;
              const parsed = Number(raw);
              return Number.isFinite(parsed) ? parsed : line.quantity;
            })(),
            unitPriceMinor: line.unitPriceMinor,
            amountMinor: fromMajor(
              lineAmountDrafts[i] ?? toMajor(line.amountMinor),
            ),
            taxMinor: line.taxMinor,
            taxCodeId: line.taxCodeId,
            glAccountId: line.glAccountId,
            costCenterId: line.costCenterId,
            categoryId: line.categoryId,
            purchaseOrderLineId: line.purchaseOrderLineId,
          })),
        }),
      });
      setInvoice(inv);
      {
        const mappedLines = mapEditLines(inv.lines ?? []);
        setEditLines(mappedLines);
        const drafts = lineDraftsFromLines(mappedLines);
        setLineAmountDrafts(drafts.amounts);
        setLineQtyDrafts(drafts.qtys);
      }
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

  async function onUploadAttachment(e: FormEvent) {
    e.preventDefault();
    if (!id || !attachFile) return;
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', attachFile);
      if (attachLabel.trim()) form.append('label', attachLabel.trim());
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const res = await fetch(`/api/invoices/${id}/attachments`, {
        method: 'POST',
        headers,
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        const msg = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message ?? `Upload failed (${res.status})`;
        throw new Error(msg);
      }
      setAttachFile(null);
      setAttachLabel('');
      setAttachInputKey((k) => k + 1);
      await loadSidePanels(id);
      setMessage('Attachment uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function goNext() {
    if (!id) return;
    try {
      const data = await apiFetch<{ nextId: string | null }>(
        `/api/invoices/${id}/next?status=needs_review`,
      );
      if (data.nextId) navigate(`/invoices/${data.nextId}`);
    } catch {
      /* stay */
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
      setMessage('Approved — billable transaction recorded');
      await goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  async function onReject() {
    if (!id) return;
    const comment = window.prompt('Reject comment (required)');
    if (!comment?.trim()) {
      setError('A comment is required when rejecting.');
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/invoices/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: comment.trim() }),
      });
      const tasks = await apiFetch<{ id: string; invoiceId: string }[]>(
        '/api/approvals/my-work',
      );
      const mine = tasks.find((t) => t.invoiceId === id);
      if (mine) {
        await apiFetch(`/api/approvals/${mine.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ comment: comment.trim() }),
        });
      } else if (
        invoice &&
        ['needs_review', 'exception', 'captured', 'extracting'].includes(
          invoice.status,
        )
      ) {
        await apiFetch(`/api/invoices/${id}/void`, { method: 'POST' });
      } else {
        throw new Error('Nothing to reject on this invoice');
      }
      setMessage('Rejected');
      await goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
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

  async function onRecall() {
    if (!id) return;
    setError(null);
    try {
      const inv = await apiFetch<Invoice>(`/api/invoices/${id}/recall`, {
        method: 'POST',
      });
      setInvoice(inv);
      {
        const mappedLines = mapEditLines(inv.lines ?? []);
        setEditLines(mappedLines);
        const drafts = lineDraftsFromLines(mappedLines);
        setLineAmountDrafts(drafts.amounts);
        setLineQtyDrafts(drafts.qtys);
      }
      setMessage('Recalled — back to Needs review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recall failed');
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

  const fieldsLocked = [
    'in_approval',
    'approved',
    'exported',
    'paid',
    'void',
  ].includes(invoice.status);

  return (
    <section className="page page--hitl">
      <header className="hitl-header">
        <div>
          <p className="eyebrow">Document review</p>
          <h1>{invoice.invoiceNumber ?? 'Draft invoice'}</h1>
          <p className="lede hitl-header__meta">
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.ocrConfidence != null && (
              <StatusBadge tone={ocrConfidenceTone(invoice.ocrConfidence)}>
                OCR {(invoice.ocrConfidence * 100).toFixed(0)}%
              </StatusBadge>
            )}
            {invoice.fileAsset && (
              <span className="muted">{invoice.fileAsset.originalName}</span>
            )}
          </p>
        </div>
        <div className="hitl-header__actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/invoices')}>
            Back
          </button>
          {invoice.status === 'in_approval' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void onRecall()}
            >
              Recall
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void onSubmit()}
              disabled={
                invoice.status === 'approved' ||
                invoice.status === 'exported' ||
                invoice.status === 'paid' ||
                invoice.status === 'void'
              }
            >
              Submit
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void onApprove()}
            disabled={
              invoice.status === 'approved' ||
              invoice.status === 'exported' ||
              invoice.status === 'paid' ||
              invoice.status === 'void'
            }
          >
            Approve
          </button>
          <button
            type="button"
            className="btn btn--danger-ghost"
            onClick={() => void onReject()}
            disabled={
              invoice.status === 'approved' ||
              invoice.status === 'exported' ||
              invoice.status === 'paid' ||
              invoice.status === 'void'
            }
          >
            Reject
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void goNext()}
          >
            Next
          </button>
        </div>
      </header>

      <div className={`hitl-split${dragging ? ' hitl-split--dragging' : ''}`}>
        <aside className="hitl-doc" aria-label="Original scanned document">
          <div className="hitl-doc__toolbar">
            <h2>Original scan</h2>
            <p>
              Drag a highlighted region (or chip) onto a form field. Keyboard: Tab
              review fields · A approve · R reject · N next.
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
                      {chip.confidence != null && (
                        <span className="hitl-chip__conf">
                          {Math.round(chip.confidence * 100)}%
                        </span>
                      )}
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

          {matchPanel && (
            <div className="hitl-alert hitl-alert--soft">
              <h2>PO match</h2>
              {matchPanel.po ? (
                <p>
                  PO {matchPanel.po.number} · {matchPanel.po.status} · invoice{' '}
                  {matchPanel.invoice.totalMinor ?? '—'} vs PO{' '}
                  {matchPanel.po.totalMinor ?? '—'}
                </p>
              ) : (
                <p className="muted">No purchase order linked.</p>
              )}
              {matchPanel.lines.length > 0 && (
                <ul className="match-lines">
                  {matchPanel.lines.map((row) => (
                    <li key={row.invoiceLineNo} className={`match-lines__${row.state}`}>
                      Line {row.invoiceLineNo} {row.invoiceDesc ?? ''} · {row.state}
                    </li>
                  ))}
                </ul>
              )}
              {matchPanel.issues.map((x) => (
                <p key={x.code} className="error">
                  {x.code}: {x.message}
                </p>
              ))}
            </div>
          )}

          {vendor360 && (
            <div className="hitl-alert hitl-alert--soft">
              <h2>Vendor 360 · {vendor360.vendor.name}</h2>
              <p className="muted">
                Spend on recent invoices: {(vendor360.spendMinor / 100).toFixed(2)} ·{' '}
                {vendor360.openExceptions} open exceptions
              </p>
              <ul>
                {vendor360.invoices.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    <Link to={`/invoices/${row.id}`}>
                      {row.invoiceNumber ?? row.id.slice(0, 8)}
                    </Link>{' '}
                    · {row.status}
                  </li>
                ))}
              </ul>
              {codingSuggest && codingSuggest.lines.length > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setEditLines((prev) =>
                      prev.map((line, i) => ({
                        ...line,
                        ...codingSuggest.lines[
                          Math.min(i, codingSuggest.lines.length - 1)
                        ],
                      })),
                    );
                    setMessage('Applied last coding for this vendor');
                  }}
                >
                  Apply last coding
                  {codingSuggest.sourceNumber
                    ? ` from ${codingSuggest.sourceNumber}`
                    : ''}
                </button>
              )}
            </div>
          )}

          <form className="workspace-form hitl-form" onSubmit={onSave}>
            <fieldset
              disabled={fieldsLocked}
              className="hitl-fieldset"
              onKeyDown={(e) => {
                if (e.key !== 'Tab') return;
                const current = (e.target as HTMLElement).closest('.hitl-field');
                if (!current) return;
                const all = [
                  ...e.currentTarget.querySelectorAll('.hitl-field'),
                ];
                const review = all.filter(
                  (el) => !el.classList.contains('hitl-field--high'),
                );
                const pool = review.length > 0 ? review : all;
                if (pool.length === 0) return;
                e.preventDefault();
                const fromIdx = all.indexOf(current);
                const dir = e.shiftKey ? -1 : 1;
                const len = all.length;
                for (let step = 1; step <= len; step += 1) {
                  const el = all[(fromIdx + dir * step + len * 20) % len];
                  if (el && pool.includes(el)) {
                    el.querySelector<HTMLElement>(
                      'input, select, textarea',
                    )?.focus();
                    return;
                  }
                }
              }}
            >
            {fieldsLocked && (
              <p className="muted span-2">
                Fields are read-only while status is {invoice.status.replace(/_/g, ' ')}.
                {invoice.status === 'in_approval'
                  ? ' Use Recall to return to Needs review.'
                  : ''}
              </p>
            )}
            <DropField
              label="Invoice number"
              fieldKey="invoiceNumber"
              dropActive={dragging || !!armedChip}
              onDropValue={applyChipValue}
              confidence={fieldConf('invoiceNumber')}
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
              confidence={fieldConf('vendorName')}
            >
              <input
                value={vendorNameRaw}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setVendorNameRaw(e.target.value);
                  setVendorMatchHint(null);
                }}
                onBlur={() => tryVendorMatch(vendorNameRaw, vendors, vendorId)}
                onFocus={() => onFieldFocus('vendorNameRaw')}
              />
            </DropField>
            <label className="hitl-field">
              <span className="hitl-field__label">Vendor master</span>
              <select
                value={vendorId}
                onChange={(e) => {
                  setVendorId(e.target.value);
                  setVendorMatchHint(null);
                }}
              >
                <option value="">— none —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
              {vendorMatchHint && (
                <span className="muted">Matched: {vendorMatchHint}</span>
              )}
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
              <select
                value={currency}
                onChange={(e) => {
                  clearArmedOnEdit();
                  setCurrency(e.target.value);
                }}
                onFocus={() => onFieldFocus('currency')}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
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

            <div className="span-2 hitl-lines-edit">
              <h3>Line items</h3>
              {editLines.length === 0 && (
                <p className="muted">No line items yet.</p>
              )}
              {editLines.map((line, index) => (
                <div key={line.id ?? `new-${index}`} className="hitl-line-row">
                  <div className="hitl-line-row__fields">
                  <label>
                    <span className="muted">#{index + 1} Description</span>
                    <input
                      value={line.description ?? ''}
                      onChange={(e) =>
                        updateEditLine(index, {
                          description: e.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Qty</span>
                    <input
                      value={lineQtyDrafts[index] ?? ''}
                      inputMode="decimal"
                      onChange={(e) => onQtyChange(index, e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="muted">Amount</span>
                    <input
                      value={lineAmountDrafts[index] ?? ''}
                      inputMode="decimal"
                      onChange={(e) => onAmountChange(index, e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="muted">Tax code</span>
                    <select
                      value={line.taxCodeId ?? ''}
                      onChange={(e) => onTaxCodeChange(index, e.target.value)}
                    >
                      <option value="">— none —</option>
                      {taxCodes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} ({(t.rateBps / 100).toFixed(2)}%)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="muted">Category</span>
                    <select
                      value={line.categoryId ?? ''}
                      onChange={(e) => onCategoryChange(index, e.target.value)}
                    >
                      <option value="">— none —</option>
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="muted">GL account</span>
                    <select
                      value={line.glAccountId ?? ''}
                      onChange={(e) =>
                        updateEditLine(index, {
                          glAccountId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">— none —</option>
                      {glAccounts.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="muted">Cost center</span>
                    <select
                      value={line.costCenterId ?? ''}
                      onChange={(e) =>
                        updateEditLine(index, {
                          costCenterId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">— none —</option>
                      {costCenters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {purchaseOrderId && (
                    <label>
                      <span className="muted">PO line</span>
                      <select
                        value={line.purchaseOrderLineId ?? ''}
                        onChange={(e) =>
                          updateEditLine(index, {
                            purchaseOrderLineId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">— none —</option>
                        {poLines.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            #{pl.lineNo} {pl.description ?? '—'}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost hitl-line-row__remove"
                    onClick={() => removeEditLine(index)}
                  >
                    Remove line
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={addEditLine}
              >
                Add line
              </button>
            </div>

            {error && <p className="error span-2">{error}</p>}
            {message && <p className="ok span-2">{message}</p>}

            <div className="span-2 actions">
              {!fieldsLocked && (
                <button type="submit" className="btn btn--primary">
                  Save fields
                </button>
              )}
            </div>
            </fieldset>
          </form>

          <div className="hitl-sidepanel">
            <details open>
              <summary>
                Attachments ({invoice.attachments?.length ?? 0})
              </summary>
              <ul className="task-list">
                {(invoice.attachments ?? []).map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{a.fileAsset.originalName}</strong>
                      {a.label && <span className="muted"> · {a.label}</span>}
                      <span className="muted">
                        {' '}
                        · {(a.fileAsset.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </li>
                ))}
                {(invoice.attachments?.length ?? 0) === 0 && (
                  <li className="muted">No supporting attachments.</li>
                )}
              </ul>
              <form
                className="inline-form"
                onSubmit={(e) => void onUploadAttachment(e)}
              >
                <FileSelect
                  key={attachInputKey}
                  onChange={(files) => setAttachFile(files?.[0] ?? null)}
                />
                <input
                  value={attachLabel}
                  onChange={(e) => setAttachLabel(e.target.value)}
                  placeholder="Label (optional)"
                  style={{ flex: 1, minWidth: '8rem' }}
                />
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!attachFile}
                >
                  Upload
                </button>
              </form>
            </details>
          </div>

          <div className="hitl-sidepanel">
            <details>
              <summary>Activity ({activity.length})</summary>
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
                      <p className="activity-feed__body">
                        {formatAction(item.action)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="hitl-sidepanel">
            <details>
              <summary>Comments ({comments.length})</summary>
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
              placeholder="Add a comment… use @email to mention"
                  required
                  style={{ flex: 1, minWidth: '12rem' }}
                />
                <button type="submit" className="btn btn--primary">
                  Post
                </button>
              </form>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
