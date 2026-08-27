import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { InvoiceValidationService } from '../../invoice-rules/application/invoice-validation.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
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
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly validation: InvoiceValidationService,
  ) {}

  async ensureMailbox(tenantId: string) {
    const existing = await this.prisma.captureMailbox.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const token = randomBytes(24).toString('hex');
    return this.prisma.captureMailbox.create({
      data: {
        tenantId,
        token,
        address: `${tenant.slug}-invoices@inbound.aptora.local`,
      },
    });
  }

  async getMailbox(tenantId: string) {
    const mailbox = await this.ensureMailbox(tenantId);
    return this.toMailboxDto(mailbox);
  }

  async rotateMailbox(tenantId: string, actorId?: string) {
    const mailbox = await this.ensureMailbox(tenantId);
    const updated = await this.prisma.captureMailbox.update({
      where: { id: mailbox.id },
      data: {
        token: randomBytes(24).toString('hex'),
        rotatedAt: new Date(),
      },
    });
    await this.audit.record({
      tenantId,
      actorId,
      action: 'mailbox.rotated',
      entityType: 'CaptureMailbox',
      entityId: updated.id,
    });
    return this.toMailboxDto(updated);
  }

  async listEmailIngests(tenantId: string, limit = 50) {
    return this.prisma.emailIngest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async ingestEmail(input: {
    token: string;
    messageId: string;
    fromAddress?: string;
    subject?: string;
    file: UploadedFile;
  }) {
    const mailbox = await this.prisma.captureMailbox.findUnique({
      where: { token: input.token },
    });
    if (!mailbox || !mailbox.enabled) {
      throw new NotFoundException('Mailbox not found');
    }

    const existing = await this.prisma.emailIngest.findUnique({
      where: {
        tenantId_messageId: {
          tenantId: mailbox.tenantId,
          messageId: input.messageId,
        },
      },
    });
    if (existing) {
      return {
        duplicate: true,
        emailIngestId: existing.id,
        status: existing.status,
        invoiceId: existing.invoiceId,
      };
    }

    const email = await this.prisma.emailIngest.create({
      data: {
        tenantId: mailbox.tenantId,
        messageId: input.messageId,
        fromAddress: input.fromAddress?.trim() || null,
        subject: input.subject?.trim() || null,
        status: 'processing',
      },
    });

    try {
      const invoice = await this.uploadAndExtract(
        mailbox.tenantId,
        input.file,
        {
          source: 'email',
          skipNotify: false,
        },
      );

      await this.prisma.emailIngest.update({
        where: { id: email.id },
        data: {
          status: 'completed',
          invoiceId: invoice.id,
        },
      });

      await this.audit.record({
        tenantId: mailbox.tenantId,
        action: 'email.ingested',
        entityType: 'EmailIngest',
        entityId: email.id,
        meta: {
          messageId: input.messageId,
          fromAddress: input.fromAddress ?? null,
          invoiceId: invoice.id,
        },
      });

      return {
        duplicate: false,
        emailIngestId: email.id,
        status: 'completed' as const,
        invoiceId: invoice.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ingest failed';
      await this.prisma.emailIngest.update({
        where: { id: email.id },
        data: {
          status: 'failed',
          errorMessage: message,
        },
      });
      throw error;
    }
  }

  async uploadAndExtract(
    tenantId: string,
    file: UploadedFile,
    options?: {
      actorId?: string;
      source?: 'upload' | 'email';
      skipNotify?: boolean;
    },
  ) {
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
        notes: options?.source === 'email' ? 'source:email' : 'source:upload',
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
        ocrPayload: stub.payload as unknown as Prisma.InputJsonValue,
        notes: `ocr:${stub.provider};source:${options?.source ?? 'upload'}`,
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

    await this.validation.syncExceptions(tenantId, invoice.id);
    invoice = await this.prisma.invoice.findFirstOrThrow({
      where: { id: invoice.id },
      include: { lines: true, exceptions: true, fileAsset: true },
    });

    await this.audit.record({
      tenantId,
      actorId: options?.actorId,
      action:
        options?.source === 'email' ? 'invoice.captured_email' : 'invoice.uploaded',
      entityType: 'Invoice',
      entityId: invoice.id,
      meta: {
        originalName: file.originalname,
        source: options?.source ?? 'upload',
      },
    });

    if (!options?.skipNotify) {
      await this.notifications.notifyRoles(
        tenantId,
        ['admin', 'ap_manager', 'ap_clerk'],
        {
          type: 'invoice.captured',
          title: 'New invoice captured',
          body: `${file.originalname} is ready for review.`,
          href: `/invoices/${invoice.id}`,
        },
      );
    }

    return invoice;
  }

  private toMailboxDto(mailbox: {
    id: string;
    tenantId: string;
    address: string;
    token: string;
    enabled: boolean;
    createdAt: Date;
    rotatedAt: Date | null;
  }) {
    return {
      id: mailbox.id,
      tenantId: mailbox.tenantId,
      address: mailbox.address,
      token: mailbox.token,
      enabled: mailbox.enabled,
      ingestPath: `/api/capture/email/${mailbox.token}`,
      createdAt: mailbox.createdAt.toISOString(),
      rotatedAt: mailbox.rotatedAt?.toISOString() ?? null,
    };
  }
}
