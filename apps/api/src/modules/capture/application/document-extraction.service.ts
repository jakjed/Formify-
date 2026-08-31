import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { UsageService } from '../../usage/application/usage.service';
import type {
  DocumentDocType,
  StoredExtraction,
} from '../domain/document-extraction.types';
import type { OcrResult } from '../domain/ocr.types';
import { OcrService } from './ocr.service';
import type { UploadedFile } from '../domain/upload.types';

@Injectable()
export class DocumentExtractionService {
  private readonly storageRoot = path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? 'storage/uploads',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocr: OcrService,
    private readonly usage: UsageService,
  ) {}

  hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /** Skip stale stub/cache-stub results when Textract is configured. */
  shouldUseCachedExtraction(extraction: StoredExtraction): boolean {
    const configured = (process.env.OCR_PROVIDER ?? 'stub').toLowerCase();
    if (configured !== 'textract') return true;
    const cachedProvider = extraction.provider?.toLowerCase() ?? '';
    if (cachedProvider === 'stub') return false;
    if (cachedProvider.startsWith('cache:stub')) return false;
    return extraction.invoice?.provider !== 'stub';
  }

  async findCachedExtraction(tenantId: string, contentHash: string) {
    return this.prisma.fileAsset.findFirst({
      where: {
        tenantId,
        contentHash,
        extractionPayload: { not: Prisma.DbNull },
      },
      orderBy: { extractedAt: 'desc' },
    });
  }

  async storeFileAsset(
    tenantId: string,
    file: UploadedFile,
    contentHash: string,
  ) {
    await mkdir(this.storageRoot, { recursive: true });
    const id = randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = path.join(
      this.storageRoot,
      `${tenantId}_${id}_${safeName}`,
    );
    await writeFile(storagePath, file.buffer);
    const pageCount = Math.max(1, Math.ceil(file.size / 50_000));
    return this.prisma.fileAsset.create({
      data: {
        tenantId,
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath,
        pageCount,
        contentHash,
      },
    });
  }

  async extractDocument(
    tenantId: string,
    file: UploadedFile,
    docType: DocumentDocType,
  ): Promise<{
    fileAsset: {
      id: string;
      tenantId: string;
      storagePath: string;
      pageCount: number;
      contentHash: string | null;
    };
    extraction: StoredExtraction;
    source: 'cache' | 'provider';
    pageCount: number;
  }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'text/plain',
    ];
    if (
      !allowed.includes(file.mimetype) &&
      !file.originalname.match(/\.(pdf|png|jpe?g|txt)$/i)
    ) {
      throw new BadRequestException('Unsupported file type');
    }

    const contentHash = this.hashBuffer(file.buffer);
    const cached = await this.findCachedExtraction(tenantId, contentHash);

    const fileAsset = await this.storeFileAsset(tenantId, file, contentHash);
    const pageCount = fileAsset.pageCount;

    if (cached?.extractionPayload) {
      const extraction = cached.extractionPayload as unknown as StoredExtraction;
      if (this.shouldUseCachedExtraction(extraction)) {
        const updated = await this.prisma.fileAsset.update({
          where: { id: fileAsset.id },
          data: {
            extractionPayload: cached.extractionPayload as Prisma.InputJsonValue,
            fullText: cached.fullText,
            extractionProvider: `cache:${cached.extractionProvider ?? 'unknown'}`,
            extractedAt: cached.extractedAt ?? new Date(),
          },
        });
        return {
          fileAsset: updated,
          extraction,
          source: 'cache',
          pageCount,
        };
      }
    }

    const raw = await this.ocr.extract(
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      },
      docType,
    );

    let extraction: StoredExtraction;
    if (docType === 'contract') {
      extraction = {
        docType: 'contract',
        provider: raw.provider,
        confidence: raw.confidence,
        payload: raw.payload,
        fullText: raw.fullText ?? '',
        contract: raw.contract,
      };
    } else {
      extraction = {
        docType: 'invoice',
        provider: raw.provider,
        confidence: raw.confidence,
        payload: raw.payload,
        fullText: raw.fullText ?? '',
        invoice: raw as OcrResult,
      };
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: fileAsset.id },
      data: {
        extractionPayload: extraction as unknown as Prisma.InputJsonValue,
        fullText: extraction.fullText,
        extractionProvider: raw.provider,
        extractedAt: new Date(),
      },
    });

    await this.usage.incrementOcrPages(tenantId, pageCount);

    return {
      fileAsset: updated,
      extraction,
      source: 'provider',
      pageCount,
    };
  }
}
