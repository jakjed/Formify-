import type { OcrPayload } from './ocr.types';

export type DocumentDocType = 'invoice' | 'contract';

export type ContractExtractFields = {
  title?: string | null;
  agreementType?: string | null;
  purpose?: string | null;
  serviceDescription?: string | null;
  termType?: string | null;
  noticePeriod?: string | null;
  counterpartyName?: string | null;
  currency?: string;
  valueMinor?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
};

export type StoredExtraction = {
  docType: DocumentDocType;
  provider: string;
  confidence: number;
  payload: OcrPayload;
  fullText: string;
  invoice?: import('./ocr.types').OcrResult;
  contract?: ContractExtractFields;
};

export type ExtractionSource = 'provider' | 'cache' | 'stub';
