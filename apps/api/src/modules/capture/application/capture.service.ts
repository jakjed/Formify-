import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UsageService } from '../../usage/application/usage.service';

export type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class CaptureService {
  private readonly storageRoot = path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? 'storage/uploads',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  async uploadAndExtract(tenantId: string, file: UploadedFile) {
    if (!file) throw new BadRequestException('File is required');
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'text/plain',
    ];
    if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(pdf|png|jpe?g|txt)$/i)) {
      throw new BadRequestException('Unsupported file type');
    }

    await mkdir(this.storageRoot, { recursive: true });
    const id = randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = path.join(this.storageRoot, `${tenantId}_${id}_${safeName}`);
    await writeFile(storagePath, file.buffer);

    const pageCount = Math.max(1, Math.ceil(file.size / 50_000));

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        tenantId,
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath,
        pageCount,
      },
    });

    const entity = await this.prisma.entity.findFirst({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    let invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        entityId: entity?.id,
        fileAssetId: fileAsset.id,
        status: 'extracting',
      },
      include: { lines: true, exceptions: true, fileAsset: true },
    });

    // Stub OCR (Textract later) — produce reviewable draft
    const stub = this.stubOcr(file.originalname, file.buffer);
    const vendor = stub.vendorName
      ? await this.prisma.vendor.findFirst({
          where: {
            tenantId,
            OR: [
              { name: { equals: stub.vendorName, mode: 'insensitive' } },
              { name: { contains: stub.vendorName, mode: 'insensitive' } },
            ],
            active: true,
          },
        })
      : null;

    invoice = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: stub.needsReview ? 'needs_review' : 'needs_review',
        vendorNameRaw: stub.vendorName,
        vendorId: vendor?.id,
        invoiceNumber: stub.invoiceNumber,
        invoiceDate: stub.invoiceDate,
        dueDate: stub.dueDate,
        currency: stub.currency,
        subtotalMinor: stub.subtotalMinor,
        taxMinor: stub.taxMinor,
        totalMinor: stub.totalMinor,
        ocrConfidence: stub.confidence,
        lines: {
          create: stub.lines.map((line, idx) => ({
            lineNo: idx + 1,
            description: line.description,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
            amountMinor: line.amountMinor,
          })),
        },
        exceptions: {
          create: stub.exceptions,
        },
      },
      include: { lines: true, exceptions: true, fileAsset: true },
    });

    await this.usage.incrementOcrPages(tenantId, pageCount);

    return invoice;
  }

  private stubOcr(originalName: string, buffer: Buffer) {
    const text = buffer.toString('utf8');
    const looksLikeText = originalName.toLowerCase().endsWith('.txt') || text.includes('INVOICE');

    const vendorFromName = originalName
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();

    if (looksLikeText) {
      const vendorMatch = text.match(/^\s*vendor:\s*(.+)$/im);
      const numberMatch = text.match(/^\s*invoice\s*(?:#|no\.?|number)?\s*[:=]\s*([A-Z0-9-]+)\s*$/im);
      const totalMatch = text.match(/^\s*total:\s*([0-9]+(?:\.[0-9]{1,2})?)\s*$/im);
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
              : [{ code: 'VENDOR_UNMATCHED', message: 'Could not confidently match vendor' }],
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
        { code: 'OCR_LOW', message: 'Stub OCR — Textract not wired yet; review required' },
        {
          code: 'VENDOR_UNMATCHED',
          message: 'Vendor not matched — select or create in Directory',
        },
      ],
    };
  }
}
