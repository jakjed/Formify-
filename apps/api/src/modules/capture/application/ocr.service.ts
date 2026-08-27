import { Injectable, Logger } from '@nestjs/common';
import type { OcrInput, OcrResult } from '../domain/ocr.types';
import { stubOcr } from './stub-ocr';
import { textractOcr } from './textract-ocr';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extract(input: OcrInput): Promise<OcrResult> {
    const provider = (process.env.OCR_PROVIDER ?? 'stub').toLowerCase();
    if (provider !== 'textract') {
      return stubOcr(input);
    }

    const hasAws =
      Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) ||
      Boolean(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) ||
      Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE);

    if (!hasAws && !process.env.AWS_REGION && !process.env.AWS_DEFAULT_REGION) {
      this.logger.warn(
        'OCR_PROVIDER=textract but no AWS region/creds detected — falling back to stub',
      );
      return stubOcr(input);
    }

    try {
      return await textractOcr(input);
    } catch (err) {
      this.logger.error(
        `Textract failed, falling back to stub: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      const fallback = stubOcr(input);
      return {
        ...fallback,
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
