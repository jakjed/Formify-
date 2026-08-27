import {
  AnalyzeExpenseCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import type {
  OcrBBox,
  OcrFieldHit,
  OcrInput,
  OcrResult,
} from '../domain/ocr.types';
import { emptyPayload, hit } from '../domain/ocr.types';

type Detection = {
  Text?: string;
  Confidence?: number;
  Geometry?: {
    BoundingBox?: {
      Left?: number;
      Top?: number;
      Width?: number;
      Height?: number;
    };
  };
};

type SummaryField = {
  Type?: { Text?: string };
  ValueDetection?: Detection;
};

function moneyToMinor(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

function toMajor(minor: number | null): string | null {
  if (minor == null) return null;
  return (minor / 100).toFixed(2);
}

function bboxFrom(detection?: Detection, page = 1): OcrBBox | null {
  const b = detection?.Geometry?.BoundingBox;
  if (
    b?.Left == null ||
    b.Top == null ||
    b.Width == null ||
    b.Height == null
  ) {
    return null;
  }
  return {
    left: b.Left,
    top: b.Top,
    width: b.Width,
    height: b.Height,
    page,
  };
}

function pickSummary(
  summary: SummaryField[],
  type: string,
): { text: string | null; confidence: number; bbox: OcrBBox | null } {
  const row = summary.find((s) => s.Type?.Text === type);
  return {
    text: row?.ValueDetection?.Text ?? null,
    confidence: row?.ValueDetection?.Confidence ?? 0,
    bbox: bboxFrom(row?.ValueDetection),
  };
}

function collect(
  ...items: Array<OcrFieldHit | null | undefined>
): OcrFieldHit[] {
  return items.filter((x): x is OcrFieldHit => Boolean(x));
}

export async function textractOcr(input: OcrInput): Promise<OcrResult> {
  const client = new TextractClient({
    region:
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'eu-west-1',
  });

  const response = await client.send(
    new AnalyzeExpenseCommand({
      Document: { Bytes: input.buffer },
    }),
  );

  const doc = response.ExpenseDocuments?.[0];
  const summary = doc?.SummaryFields ?? [];
  const vendor = pickSummary(summary, 'VENDOR_NAME');
  const invoiceNumber = pickSummary(summary, 'INVOICE_RECEIPT_ID');
  const total = pickSummary(summary, 'TOTAL');
  const subtotal = pickSummary(summary, 'SUBTOTAL');
  const tax = pickSummary(summary, 'TAX');
  const invoiceDate = pickSummary(summary, 'INVOICE_RECEIPT_DATE');
  const dueDate = pickSummary(summary, 'DUE_DATE');

  const confidences = [vendor, invoiceNumber, total]
    .map((x) => x.confidence)
    .filter((c) => c > 0);
  const confidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
      : 0.4;

  const lineHits: OcrFieldHit[] = [];
  const lines =
    doc?.LineItemGroups?.flatMap((group, groupIdx) =>
      (group.LineItems ?? []).map((item, itemIdx) => {
        const fields = item.LineItemExpenseFields ?? [];
        const descField = fields.find((f) => f.Type?.Text === 'ITEM');
        const priceField = fields.find((f) => f.Type?.Text === 'PRICE');
        const qtyField = fields.find((f) => f.Type?.Text === 'QUANTITY');
        const desc = descField?.ValueDetection?.Text ?? null;
        const amount = moneyToMinor(priceField?.ValueDetection?.Text);
        const qtyRaw = qtyField?.ValueDetection?.Text;
        const quantity = qtyRaw ? Number.parseFloat(qtyRaw) : 1;
        const lineNo = groupIdx * 100 + itemIdx + 1;
        const descriptionBBox = bboxFrom(descField?.ValueDetection);
        const amountBBox = bboxFrom(priceField?.ValueDetection);
        const quantityBBox = bboxFrom(qtyField?.ValueDetection);

        const descHit = hit(
          `line-${lineNo}-desc`,
          'lineDescription',
          `Line ${lineNo}`,
          desc,
          descriptionBBox,
          descField?.ValueDetection?.Confidence
            ? descField.ValueDetection.Confidence / 100
            : null,
        );
        const amtHit = hit(
          `line-${lineNo}-amt`,
          'lineAmount',
          `Amount ${lineNo}`,
          toMajor(amount),
          amountBBox,
          priceField?.ValueDetection?.Confidence
            ? priceField.ValueDetection.Confidence / 100
            : null,
        );
        const qtyHit = hit(
          `line-${lineNo}-qty`,
          'lineQuantity',
          `Qty ${lineNo}`,
          qtyRaw ?? null,
          quantityBBox,
          qtyField?.ValueDetection?.Confidence
            ? qtyField.ValueDetection.Confidence / 100
            : null,
        );
        if (descHit) lineHits.push(descHit);
        if (amtHit) lineHits.push(amtHit);
        if (qtyHit) lineHits.push(qtyHit);

        return {
          description: desc,
          quantity: Number.isNaN(quantity) ? 1 : quantity,
          unitPriceMinor: amount,
          amountMinor: amount,
          descriptionBBox,
          amountBBox,
          quantityBBox,
        };
      }),
    ) ?? [];

  const totalMinor = moneyToMinor(total.text ?? undefined);
  const subtotalMinor = moneyToMinor(subtotal.text ?? undefined);
  const taxMinor = moneyToMinor(tax.text ?? undefined);
  const parsedInvoiceDate = invoiceDate.text
    ? new Date(invoiceDate.text)
    : new Date();
  const parsedDueDate = dueDate.text ? new Date(dueDate.text) : null;
  const conf = (c: number) => (c > 0 ? c / 100 : null);

  const fields = collect(
    hit(
      'vendor',
      'vendorName',
      'Vendor',
      vendor.text,
      vendor.bbox,
      conf(vendor.confidence),
    ),
    hit(
      'number',
      'invoiceNumber',
      'Invoice #',
      invoiceNumber.text,
      invoiceNumber.bbox,
      conf(invoiceNumber.confidence),
    ),
    hit(
      'date',
      'invoiceDate',
      'Invoice date',
      invoiceDate.text,
      invoiceDate.bbox,
      conf(invoiceDate.confidence),
    ),
    hit(
      'due',
      'dueDate',
      'Due date',
      dueDate.text,
      dueDate.bbox,
      conf(dueDate.confidence),
    ),
    hit(
      'subtotal',
      'subtotal',
      'Subtotal',
      toMajor(subtotalMinor) ?? subtotal.text,
      subtotal.bbox,
      conf(subtotal.confidence),
    ),
    hit(
      'tax',
      'tax',
      'Tax',
      toMajor(taxMinor) ?? tax.text,
      tax.bbox,
      conf(tax.confidence),
    ),
    hit(
      'total',
      'total',
      'Total',
      toMajor(totalMinor) ?? total.text,
      total.bbox,
      conf(total.confidence),
    ),
    ...lineHits,
  );

  const exceptions = [];
  if (confidence < 0.7) {
    exceptions.push({
      code: 'OCR_LOW',
      message: 'Textract confidence below threshold — please review',
    });
  }
  if (!vendor.text) {
    exceptions.push({
      code: 'VENDOR_UNMATCHED',
      message: 'Vendor name not extracted',
    });
  }

  const resolvedInvoiceNumber =
    invoiceNumber.text ?? `TX-${Date.now().toString().slice(-6)}`;
  if (!invoiceNumber.text) {
    fields.unshift({
      id: 'number',
      key: 'invoiceNumber',
      label: 'Invoice #',
      text: resolvedInvoiceNumber,
      confidence: null,
      bbox: null,
    });
  }

  return {
    vendorName: vendor.text,
    invoiceNumber: resolvedInvoiceNumber,
    invoiceDate: Number.isNaN(parsedInvoiceDate.getTime())
      ? new Date()
      : parsedInvoiceDate,
    dueDate:
      parsedDueDate && !Number.isNaN(parsedDueDate.getTime())
        ? parsedDueDate
        : null,
    currency: 'EUR',
    subtotalMinor,
    taxMinor,
    totalMinor,
    confidence,
    needsReview: true,
    lines:
      lines.length > 0
        ? lines
        : [
            {
              description: 'Textract document',
              quantity: 1,
              unitPriceMinor: totalMinor,
              amountMinor: totalMinor,
            },
          ],
    exceptions,
    provider: 'textract',
    payload: emptyPayload('textract', fields),
  };
}
