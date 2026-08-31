import type {
  OcrBBox,
  OcrFieldHit,
  OcrInput,
  OcrPayload,
  OcrResult,
} from '../domain/ocr.types';
import { emptyPayload, hit, synthBBox } from '../domain/ocr.types';

function toMajor(minor: number | null): string | null {
  if (minor == null) return null;
  return (minor / 100).toFixed(2);
}

function collect(
  ...items: Array<OcrFieldHit | null | undefined>
): OcrFieldHit[] {
  return items.filter((x): x is OcrFieldHit => Boolean(x));
}

export function stubOcr(input: OcrInput): OcrResult {
  const { originalName, buffer, mimeType } = input;
  const isTextFile =
    mimeType?.toLowerCase().startsWith('text/') ||
    originalName.toLowerCase().endsWith('.txt');
  const text = isTextFile
    ? buffer.toString('utf8').replace(/\0/g, '')
    : '';
  const looksLikeText = isTextFile && text.toLowerCase().includes('invoice');

  const vendorFromName = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (looksLikeText) {
    const vendorMatch = text.match(/^\s*vendor:\s*(.+)$/im);
    const numberMatch = text.match(
      /^\s*invoice\s*(?:#|no\.?|number)?\s*[:=]\s*([A-Z0-9-]+)\s*$/im,
    );
    const totalMatch = text.match(
      /^\s*total:\s*([0-9]+(?:\.[0-9]{1,2})?)\s*$/im,
    );
    const currencyMatch = text.match(/^\s*currency:\s*([A-Z]{3})\s*$/im);
    const total = totalMatch
      ? Math.round(parseFloat(totalMatch[1]!) * 100)
      : null;
    const confidence = numberMatch && total ? 0.82 : 0.45;
    const vendorName = vendorMatch?.[1]?.trim() ?? vendorFromName;
    const invoiceNumber =
      numberMatch?.[1] ?? `STUB-${Date.now().toString().slice(-6)}`;
    const currency = currencyMatch?.[1] ?? 'EUR';
    const invoiceDate = new Date();
    const dueDate = new Date(Date.now() + 30 * 86400000);
    const subtotalMinor =
      total != null ? Math.round(total / 1.23) : null;
    const taxMinor =
      total != null ? total - Math.round(total / 1.23) : null;

    const fields = collect(
      hit('vendor', 'vendorName', 'Vendor', vendorName, synthBBox(0), confidence),
      hit(
        'number',
        'invoiceNumber',
        'Invoice #',
        invoiceNumber,
        synthBBox(1),
        confidence,
      ),
      hit(
        'currency',
        'currency',
        'Currency',
        currency,
        synthBBox(2),
        confidence,
      ),
      hit(
        'date',
        'invoiceDate',
        'Invoice date',
        invoiceDate.toISOString().slice(0, 10),
        synthBBox(3),
        confidence,
      ),
      hit(
        'due',
        'dueDate',
        'Due date',
        dueDate.toISOString().slice(0, 10),
        synthBBox(4),
        confidence,
      ),
      hit(
        'subtotal',
        'subtotal',
        'Subtotal',
        toMajor(subtotalMinor),
        synthBBox(5),
        confidence,
      ),
      hit('tax', 'tax', 'Tax', toMajor(taxMinor), synthBBox(6), confidence),
      hit('total', 'total', 'Total', toMajor(total), synthBBox(7), confidence),
      hit(
        'line-1-desc',
        'lineDescription',
        'Line 1',
        'Stub OCR line',
        synthBBox(9),
        confidence,
      ),
      hit(
        'line-1-amt',
        'lineAmount',
        'Amount 1',
        toMajor(total),
        synthBBox(9, 1),
        confidence,
      ),
    );

    const payload: OcrPayload = emptyPayload('stub', fields);

    return {
      vendorName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      currency,
      subtotalMinor,
      taxMinor,
      totalMinor: total,
      confidence,
      needsReview: true,
      lines: [
        {
          description: 'Stub OCR line',
          quantity: 1,
          unitPriceMinor: total,
          amountMinor: total,
          descriptionBBox: synthBBox(9),
          amountBBox: synthBBox(9, 1),
        },
      ],
      exceptions:
        confidence < 0.7
          ? [
              {
                code: 'OCR_LOW',
                message: 'Low OCR confidence — please review fields',
              },
            ]
          : vendorMatch
            ? []
            : [
                {
                  code: 'VENDOR_UNMATCHED',
                  message: 'Could not confidently match vendor',
                },
              ],
      provider: 'stub',
      payload,
    };
  }

  const invoiceNumber = `STUB-${Date.now().toString().slice(-6)}`;
  const fields = collect(
    hit('vendor', 'vendorName', 'Vendor', vendorFromName || null, synthBBox(0), 0.35),
    hit(
      'number',
      'invoiceNumber',
      'Invoice #',
      invoiceNumber,
      synthBBox(1),
      0.35,
    ),
    hit('currency', 'currency', 'Currency', 'EUR', synthBBox(2), 0.35),
    hit(
      'line-1-desc',
      'lineDescription',
      'Line 1',
      'Extracted line (stub) — replace with real amounts',
      synthBBox(4),
      0.35,
    ),
  );

  return {
    vendorName: vendorFromName || null,
    invoiceNumber,
    invoiceDate: new Date(),
    dueDate: null,
    currency: 'EUR',
    subtotalMinor: null,
    taxMinor: null,
    totalMinor: null,
    confidence: 0.35,
    needsReview: true,
    lines: [
      {
        description: 'Extracted line (stub) — replace with real amounts',
        quantity: 1,
        unitPriceMinor: null,
        amountMinor: null,
        descriptionBBox: synthBBox(4),
      },
    ],
    exceptions: [
      {
        code: 'OCR_LOW',
        message:
          'Stub OCR — set OCR_PROVIDER=textract with AWS creds for real extraction',
      },
      {
        code: 'VENDOR_UNMATCHED',
        message: 'Vendor not matched — select or create in Directory',
      },
    ],
    provider: 'stub',
    payload: emptyPayload('stub', fields),
  };
}

/** Re-export for tests */
export type { OcrBBox };
