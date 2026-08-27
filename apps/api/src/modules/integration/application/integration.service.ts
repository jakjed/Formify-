import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const APPROVED_EXPORT_HEADERS = [
  'invoice_id',
  'invoice_number',
  'vendor_name',
  'vendor_id',
  'invoice_date',
  'due_date',
  'currency',
  'subtotal_minor',
  'tax_minor',
  'total_minor',
  'approved_at',
] as const;

@Injectable()
export class IntegrationService {
  private readonly storageRoot = path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? 'storage/uploads',
  );

  constructor(private readonly prisma: PrismaService) {}

  listTemplates() {
    return [
      {
        key: 'approved-invoices-export',
        name: 'Approved invoices export',
        direction: 'export',
        format: 'csv',
        headers: [...APPROVED_EXPORT_HEADERS],
      },
      {
        key: 'vendors-import',
        name: 'Vendors import (template only)',
        direction: 'import',
        format: 'csv',
        headers: ['code', 'name', 'email', 'tax_id', 'external_id'],
        note: 'Import commit lands in a later iteration — download template now',
      },
    ];
  }

  templateCsv(key: string): { fileName: string; content: string } {
    const template = this.listTemplates().find((t) => t.key === key);
    if (!template) {
      return {
        fileName: 'unknown.csv',
        content: 'error\nunknown_template\n',
      };
    }
    return {
      fileName: `${template.key}.csv`,
      content: `${template.headers.join(',')}\n`,
    };
  }

  listJobs(tenantId: string) {
    return this.prisma.integrationJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async exportApprovedInvoices(tenantId: string, userId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: 'approved' },
      orderBy: { approvedAt: 'asc' },
    });

    const lines = [APPROVED_EXPORT_HEADERS.join(',')];
    for (const inv of invoices) {
      lines.push(
        [
          inv.id,
          csv(inv.invoiceNumber),
          csv(inv.vendorNameRaw),
          inv.vendorId ?? '',
          inv.invoiceDate?.toISOString().slice(0, 10) ?? '',
          inv.dueDate?.toISOString().slice(0, 10) ?? '',
          inv.currency,
          inv.subtotalMinor ?? '',
          inv.taxMinor ?? '',
          inv.totalMinor ?? '',
          inv.approvedAt?.toISOString() ?? '',
        ].join(','),
      );
    }
    const content = `${lines.join('\n')}\n`;
    const fileName = `approved-invoices-${new Date().toISOString().slice(0, 10)}.csv`;

    await mkdir(this.storageRoot, { recursive: true });
    const storagePath = path.join(
      this.storageRoot,
      `${tenantId}_export_${Date.now()}_${fileName}`,
    );
    await writeFile(storagePath, content, 'utf8');

    const job = await this.prisma.integrationJob.create({
      data: {
        tenantId,
        type: 'export_approved_invoices',
        status: 'succeeded',
        fileName,
        storagePath,
        rowCount: invoices.length,
        createdById: userId,
        finishedAt: new Date(),
      },
    });

    if (invoices.length > 0) {
      await this.prisma.invoice.updateMany({
        where: { id: { in: invoices.map((i) => i.id) } },
        data: { status: 'exported', exportedAt: new Date() },
      });
    }

    return {
      job,
      fileName,
      content,
      rowCount: invoices.length,
    };
  }
}

function csv(value: string | null | undefined): string {
  if (value == null) return '';
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
