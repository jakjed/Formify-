import {
  AnalyzeExpenseCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import type { OcrInput, OcrResult } from '../domain/ocr.types';

function moneyToMinor(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

function pickSummary(
  summary: { Type?: { Text?: string }; ValueDetection?: { Text?: string; Confidence?: number } }[],
  type: string,
): { text: string | null; confidence: number } {
  const row = summary.find((s) => s.Type?.Text === type);
  return {
    text: row?.ValueDetection?.Text ?? null,
    confidence: row?.ValueDetection?.Confidence ?? 0,
  };
}

export async function textractOcr(input: OcrInput): Promise<OcrResult> {
  const client = new TextractClient({
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'eu-west-1',
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

  const lines =
    doc?.LineItemGroups?.flatMap((group) =>
      (group.LineItems ?? []).map((item) => {
        const fields = item.LineItemExpenseFields ?? [];
        const desc =
          fields.find((f) => f.Type?.Text === 'ITEM')?.ValueDetection?.Text ??
          null;
        const amount = moneyToMinor(
          fields.find((f) => f.Type?.Text === 'PRICE')?.ValueDetection?.Text,
        );
        const qtyRaw = fields.find((f) => f.Type?.Text === 'QUANTITY')
          ?.ValueDetection?.Text;
        const quantity = qtyRaw ? Number.parseFloat(qtyRaw) : 1;
        return {
          description: desc,
          quantity: Number.isNaN(quantity) ? 1 : quantity,
          unitPriceMinor: amount,
          amountMinor: amount,
        };
      }),
    ) ?? [];

  const totalMinor = moneyToMinor(total.text ?? undefined);
  const parsedInvoiceDate = invoiceDate.text ? new Date(invoiceDate.text) : new Date();
  const parsedDueDate = dueDate.text ? new Date(dueDate.text) : null;

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

  return {
    vendorName: vendor.text,
    invoiceNumber:
      invoiceNumber.text ?? `TX-${Date.now().toString().slice(-6)}`,
    invoiceDate: Number.isNaN(parsedInvoiceDate.getTime())
      ? new Date()
      : parsedInvoiceDate,
    dueDate:
      parsedDueDate && !Number.isNaN(parsedDueDate.getTime())
        ? parsedDueDate
        : null,
    currency: 'EUR',
    subtotalMinor: moneyToMinor(subtotal.text ?? undefined),
    taxMinor: moneyToMinor(tax.text ?? undefined),
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
  };
}
