export type OcrLine = {
  description: string | null;
  quantity: number | null;
  unitPriceMinor: number | null;
  amountMinor: number | null;
  /** Normalized Textract/stub geometry when available */
  descriptionBBox?: OcrBBox | null;
  amountBBox?: OcrBBox | null;
  quantityBBox?: OcrBBox | null;
};

export type OcrException = {
  code: string;
  message: string;
};

/** Normalized page-relative box (Textract BoundingBox convention: 0–1). */
export type OcrBBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  page: number;
};

export type OcrFieldHit = {
  id: string;
  key: string;
  label: string;
  text: string;
  confidence: number | null;
  bbox: OcrBBox | null;
};

export type OcrPayload = {
  version: 1;
  provider: 'stub' | 'textract';
  extractedAt: string;
  fields: OcrFieldHit[];
};

export type OcrResult = {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  currency: string;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  confidence: number;
  needsReview: boolean;
  lines: OcrLine[];
  exceptions: OcrException[];
  provider: 'stub' | 'textract';
  /** Structured hits with geometry for HITL overlays */
  payload: OcrPayload;
};

export type OcrInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

export function emptyPayload(
  provider: 'stub' | 'textract',
  fields: OcrFieldHit[] = [],
): OcrPayload {
  return {
    version: 1,
    provider,
    extractedAt: new Date().toISOString(),
    fields,
  };
}

export function synthBBox(row: number, col = 0): OcrBBox {
  return {
    left: Math.min(0.06 + col * 0.42, 0.52),
    top: Math.min(0.06 + row * 0.07, 0.9),
    width: col > 0 ? 0.38 : 0.7,
    height: 0.05,
    page: 1,
  };
}

export function hit(
  id: string,
  key: string,
  label: string,
  text: string | null | undefined,
  bbox: OcrBBox | null,
  confidence: number | null = null,
): OcrFieldHit | null {
  const t = text?.trim();
  if (!t) return null;
  return { id, key, label, text: t, confidence, bbox };
}
