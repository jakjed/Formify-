import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UsageService } from '../../usage/application/usage.service';
import { OcrService } from './ocr.service';

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
    private readonly ocr: OcrService,
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
    if (
      !allowed.includes(file.mimetype) &&
      !file.originalname.match(/\.(pdf|png|jpe?g|txt)$/i)
    ) {
      throw new BadRequestException('Unsupported file type');
    }

    await mkdir(this.storageRoot, { recursive: true });
    const id = randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = path.join(
      this.storageRoot,
      `${tenantId}_${id}_${safeName}`,
    );
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

    const stub = await this.ocr.extract({
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

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
        status: 'needs_review',
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
        notes: `ocr:${stub.provider}`,
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
}
