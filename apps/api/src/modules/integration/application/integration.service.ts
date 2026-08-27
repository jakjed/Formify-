import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
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

const VENDOR_IMPORT_HEADERS = [
  'code',
  'name',
  'email',
  'tax_id',
  'external_id',
] as const;

const GL_IMPORT_HEADERS = ['code', 'name'] as const;

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
        name: 'Vendors import',
        direction: 'import',
        format: 'csv',
        headers: [...VENDOR_IMPORT_HEADERS],
      },
      {
        key: 'gl-accounts-import',
        name: 'GL accounts import',
        direction: 'import',
        format: 'csv',
        headers: [...GL_IMPORT_HEADERS],
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
    const storagePath = await this.writeArtifact(tenantId, fileName, content);

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

    return { job, fileName, content, rowCount: invoices.length };
  }

  async importVendors(
    tenantId: string,
    userId: string,
    file: { originalname: string; buffer: Buffer },
  ) {
    const rows = parseCsv(file.buffer.toString('utf8'));
    if (rows.length === 0) throw new BadRequestException('CSV has no data rows');

    let upserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const code = (row.code ?? '').trim();
      const name = (row.name ?? '').trim();
      if (!code || !name) {
        errors.push(`row ${i + 2}: code and name are required`);
        continue;
      }
      await this.prisma.vendor.upsert({
        where: { tenantId_code: { tenantId, code } },
        create: {
          tenantId,
          code,
          name,
          email: emptyToNull(row.email)?.toLowerCase(),
          taxId: emptyToNull(row.tax_id),
          externalId: emptyToNull(row.external_id),
        },
        update: {
          name,
          email: emptyToNull(row.email)?.toLowerCase(),
          taxId: emptyToNull(row.tax_id),
          externalId: emptyToNull(row.external_id),
          active: true,
        },
      });
      upserted += 1;
    }

    const status = errors.length && upserted === 0 ? 'failed' : 'succeeded';
    const job = await this.prisma.integrationJob.create({
      data: {
        tenantId,
        type: 'import_vendors',
        status,
        fileName: file.originalname,
        rowCount: upserted,
        errorMessage: errors.length ? errors.slice(0, 20).join('; ') : null,
        createdById: userId,
        finishedAt: new Date(),
      },
    });

    return { job, upserted, errors };
  }

  async importGlAccounts(
    tenantId: string,
    userId: string,
    file: { originalname: string; buffer: Buffer },
  ) {
    const rows = parseCsv(file.buffer.toString('utf8'));
    if (rows.length === 0) throw new BadRequestException('CSV has no data rows');

    let upserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const code = (row.code ?? '').trim();
      const name = (row.name ?? '').trim();
      if (!code || !name) {
        errors.push(`row ${i + 2}: code and name are required`);
        continue;
      }
      await this.prisma.glAccount.upsert({
        where: { tenantId_code: { tenantId, code } },
        create: { tenantId, code, name },
        update: { name, active: true },
      });
      upserted += 1;
    }

    const status = errors.length && upserted === 0 ? 'failed' : 'succeeded';
    const job = await this.prisma.integrationJob.create({
      data: {
        tenantId,
        type: 'import_gl_accounts',
        status,
        fileName: file.originalname,
        rowCount: upserted,
        errorMessage: errors.length ? errors.slice(0, 20).join('; ') : null,
        createdById: userId,
        finishedAt: new Date(),
      },
    });

    return { job, upserted, errors };
  }

  private async writeArtifact(
    tenantId: string,
    fileName: string,
    content: string,
  ) {
    await mkdir(this.storageRoot, { recursive: true });
    const storagePath = path.join(
      this.storageRoot,
      `${tenantId}_export_${Date.now()}_${fileName}`,
    );
    await writeFile(storagePath, content, 'utf8');
    return storagePath;
  }
}

function emptyToNull(value?: string) {
  const v = value?.trim();
  return v ? v : null;
}

function csv(value: string | null | undefined): string {
  if (value == null) return '';
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
