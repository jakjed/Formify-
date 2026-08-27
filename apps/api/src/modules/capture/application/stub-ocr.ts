import type { OcrInput, OcrResult } from '../domain/ocr.types';

export function stubOcr(input: OcrInput): OcrResult {
  const { originalName, buffer } = input;
  const text = buffer.toString('utf8');
  const looksLikeText =
    originalName.toLowerCase().endsWith('.txt') ||
    text.toLowerCase().includes('invoice');

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
    const total = totalMatch ? Math.round(parseFloat(totalMatch[1]!) * 100) : null;
    const confidence = numberMatch && total ? 0.82 : 0.45;
    return {
      vendorName: vendorMatch?.[1]?.trim() ?? vendorFromName,
      invoiceNumber: numberMatch?.[1] ?? `STUB-${Date.now().toString().slice(-6)}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      currency: currencyMatch?.[1] ?? 'EUR',
      subtotalMinor: total != null ? Math.round(total / 1.23) : null,
      taxMinor: total != null ? total - Math.round(total / 1.23) : null,
      totalMinor: total,
      confidence,
      needsReview: true,
      lines: [
        {
          description: 'Stub OCR line',
          quantity: 1,
          unitPriceMinor: total,
          amountMinor: total,
        },
      ],
      exceptions:
        confidence < 0.7
          ? [{ code: 'OCR_LOW', message: 'Low OCR confidence — please review fields' }]
          : vendorMatch
            ? []
            : [
                {
                  code: 'VENDOR_UNMATCHED',
                  message: 'Could not confidently match vendor',
                },
              ],
      provider: 'stub',
    };
  }

  return {
    vendorName: vendorFromName || null,
    invoiceNumber: `STUB-${Date.now().toString().slice(-6)}`,
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
      },
    ],
    exceptions: [
      {
        code: 'OCR_LOW',
        message: 'Stub OCR — set OCR_PROVIDER=textract with AWS creds for real extraction',
      },
      {
        code: 'VENDOR_UNMATCHED',
        message: 'Vendor not matched — select or create in Directory',
      },
    ],
    provider: 'stub',
  };
}
