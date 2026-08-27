import type {
  OcrFieldHit,
  OcrInput,
  OcrPayload,
} from '../domain/ocr.types';
import { emptyPayload, hit, synthBBox } from '../domain/ocr.types';
import type { ContractExtractFields } from '../domain/document-extraction.types';

function collect(
  ...items: Array<OcrFieldHit | null | undefined>
): OcrFieldHit[] {
  return items.filter((x): x is OcrFieldHit => Boolean(x));
}

function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function stubContractOcr(input: OcrInput): {
  fields: ContractExtractFields;
  confidence: number;
  payload: OcrPayload;
  fullText: string;
} {
  const { originalName, buffer } = input;
  const text = buffer.toString('utf8');
  const titleFromName = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const titleMatch = text.match(/^\s*title:\s*(.+)$/im);
  const partyMatch = text.match(/^\s*(?:counterparty|vendor|party):\s*(.+)$/im);
  const termMatch = text.match(/^\s*term:\s*(.+)$/im);
  const noticeMatch = text.match(/^\s*notice(?:\s*period)?:\s*(.+)$/im);
  const valueMatch = text.match(/^\s*value:\s*([0-9]+(?:\.[0-9]{1,2})?)\s*$/im);
  const currencyMatch = text.match(/^\s*currency:\s*([A-Z]{3})\s*$/im);
  const effectiveMatch = text.match(
    /^\s*(?:effective|start):\s*(\d{4}-\d{2}-\d{2})\s*$/im,
  );
  const endMatch = text.match(/^\s*(?:end|expires):\s*(\d{4}-\d{2}-\d{2})\s*$/im);
  const purposeMatch = text.match(/^\s*purpose:\s*(.+)$/im);
  const servicesMatch = text.match(/^\s*services:\s*(.+)$/im);
  const typeMatch = text.match(/^\s*(?:type|agreement):\s*(.+)$/im);

  const looksLikeContract =
    Boolean(originalName.toLowerCase().match(/\.(txt|pdf)$/)) &&
    (text.toLowerCase().includes('agreement') ||
      text.toLowerCase().includes('contract') ||
      partyMatch ||
      termMatch);

  const title = titleMatch?.[1]?.trim() || titleFromName || 'Scanned agreement';
  const counterpartyName = partyMatch?.[1]?.trim() ?? null;
  const termType =
    termMatch?.[1]?.trim() ??
    (text.toLowerCase().includes('auto-renew') ? 'Auto-Renew' : 'Fixed Term');
  const noticePeriod = noticeMatch?.[1]?.trim() ?? '60 days';
  const valueMinor = parseMoney(valueMatch?.[1]);
  const currency = currencyMatch?.[1] ?? 'EUR';
  const agreementType = typeMatch?.[1]?.trim() ?? 'Vendor Agreement';
  const purpose =
    purposeMatch?.[1]?.trim() ??
    (looksLikeContract
      ? 'Commercial agreement covering vendor services (extracted from document).'
      : 'Review extracted purpose against the uploaded agreement.');
  const serviceDescription =
    servicesMatch?.[1]?.trim() ??
    'Professional / SaaS services as described in the agreement.';
  const startDate = effectiveMatch?.[1] ? new Date(effectiveMatch[1]) : null;
  const endDate = endMatch?.[1] ? new Date(endMatch[1]) : null;

  const populated = [
    titleMatch,
    partyMatch,
    termMatch,
    valueMatch,
    effectiveMatch,
  ].filter(Boolean).length;
  const confidence = looksLikeContract
    ? Math.min(0.45 + populated * 0.1, 0.88)
    : 0.38;

  const fieldHits = collect(
    hit('title', 'title', 'Title', title, synthBBox(0), confidence),
    hit(
      'party',
      'counterparty',
      'Counterparty',
      counterpartyName,
      synthBBox(1),
      confidence,
    ),
    hit(
      'type',
      'agreementType',
      'Agreement type',
      agreementType,
      synthBBox(2),
      confidence,
    ),
    hit('term', 'termType', 'Term', termType, synthBBox(3), confidence),
    hit(
      'notice',
      'noticePeriod',
      'Notice period',
      noticePeriod,
      synthBBox(4),
      confidence,
    ),
    hit(
      'value',
      'value',
      'Contract value',
      valueMinor != null ? (valueMinor / 100).toFixed(2) : null,
      synthBBox(5),
      confidence,
    ),
    hit('currency', 'currency', 'Currency', currency, synthBBox(6), confidence),
    hit(
      'start',
      'startDate',
      'Effective date',
      startDate?.toISOString().slice(0, 10) ?? null,
      synthBBox(7),
      confidence,
    ),
    hit(
      'end',
      'endDate',
      'End date',
      endDate?.toISOString().slice(0, 10) ?? null,
      synthBBox(8),
      confidence,
    ),
  );

  const fullText =
    text.trim().length > 0
      ? text.slice(0, 100_000)
      : `Contract document: ${originalName}`;

  return {
    fields: {
      title,
      agreementType,
      purpose,
      serviceDescription,
      termType,
      noticePeriod,
      counterpartyName,
      currency,
      valueMinor,
      startDate,
      endDate,
    },
    confidence,
    payload: emptyPayload('stub', fieldHits),
    fullText,
  };
}
