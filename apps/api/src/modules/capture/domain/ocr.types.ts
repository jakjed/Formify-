export type OcrLine = {
  description: string | null;
  quantity: number | null;
  unitPriceMinor: number | null;
  amountMinor: number | null;
};

export type OcrException = {
  code: string;
  message: string;
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
};

export type OcrInput = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};
