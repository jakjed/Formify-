import { Injectable, Logger } from '@nestjs/common';
import type {
  ContractExtractFields,
  DocumentDocType,
} from '../domain/document-extraction.types';
import type { OcrInput, OcrResult } from '../domain/ocr.types';
import { stubContractOcr } from './contract-stub-ocr';
import { stubOcr } from './stub-ocr';
import { textractOcr } from './textract-ocr';

export type ExtendedOcrResult = OcrResult & {
  fullText?: string;
  contract?: ContractExtractFields;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extract(
    input: OcrInput,
    docType: DocumentDocType = 'invoice',
  ): Promise<ExtendedOcrResult> {
    if (docType === 'contract') {
      return this.extractContract(input);
    }
    return this.extractInvoice(input);
  }

  private async extractContract(input: OcrInput): Promise<ExtendedOcrResult> {
    const provider = (process.env.OCR_PROVIDER ?? 'stub').toLowerCase();
    if (provider === 'textract') {
      // Contract Analyze Document profile ships later; stub locally for now.
      this.logger.debug('Contract docType uses stub until Textract Document profile');
    }
    const stub = stubContractOcr(input);
    return {
      vendorName: stub.fields.counterpartyName ?? null,
      invoiceNumber: null,
      invoiceDate: stub.fields.startDate ?? null,
      dueDate: stub.fields.endDate ?? null,
      currency: stub.fields.currency ?? 'EUR',
      subtotalMinor: stub.fields.valueMinor ?? null,
      taxMinor: null,
      totalMinor: stub.fields.valueMinor ?? null,
      confidence: stub.confidence,
      needsReview: true,
      lines: [],
      exceptions:
        stub.confidence < 0.5
          ? [
              {
                code: 'OCR_LOW',
                message: 'Low extraction confidence — review contract fields',
              },
            ]
          : [],
      provider: 'stub',
      payload: stub.payload,
      fullText: stub.fullText,
      contract: stub.fields,
    };
  }

  private async extractInvoice(input: OcrInput): Promise<ExtendedOcrResult> {
    const provider = (process.env.OCR_PROVIDER ?? 'stub').toLowerCase();
    if (provider !== 'textract') {
      const stub = stubOcr(input);
      return {
        ...stub,
        fullText: input.buffer.toString('utf8').slice(0, 100_000),
      };
    }

    const hasAws =
      Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) ||
      Boolean(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) ||
      Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE);

    if (!hasAws && !process.env.AWS_REGION && !process.env.AWS_DEFAULT_REGION) {
      this.logger.warn(
        'OCR_PROVIDER=textract but no AWS region/creds detected — falling back to stub',
      );
      const stub = stubOcr(input);
      return {
        ...stub,
        fullText: input.buffer.toString('utf8').slice(0, 100_000),
      };
    }

    try {
      const result = await textractOcr(input);
      return {
        ...result,
        fullText: input.buffer.toString('utf8').slice(0, 100_000),
      };
    } catch (err) {
      this.logger.error(
        `Textract failed, falling back to stub: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      const fallback = stubOcr(input);
      return {
        ...fallback,
        fullText: input.buffer.toString('utf8').slice(0, 100_000),
        exceptions: [
          {
            code: 'OCR_LOW',
            message: `Textract unavailable (${
              err instanceof Error ? err.message : 'error'
            }) — stub used`,
          },
          ...fallback.exceptions,
        ],
      };
    }
  }
}
