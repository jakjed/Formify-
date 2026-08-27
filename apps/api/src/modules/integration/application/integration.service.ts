import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ModuleKey } from '@aptora/types';
import { IntegrationJobType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenancyService } from '../../tenancy/application/tenancy.service';

export const DEMO_ERP_PACK_KEY = 'demo-erp';
export const NETSUITE_PACK_KEY = 'netsuite';

function hashSecret(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

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
  'purchase_order_id',
] as const;

const VENDOR_IMPORT_HEADERS = [
  'code',
  'name',
  'email',
  'tax_id',
  'external_id',
] as const;

const GL_IMPORT_HEADERS = ['code', 'name'] as const;

const CONTRACT_EXPORT_HEADERS = [
  'contract_id',
  'number',
  'title',
  'status',
  'vendor_id',
  'entity_id',
  'currency',
  'value_minor',
  'start_date',
  'end_date',
] as const;

const PR_EXPORT_HEADERS = [
  'pr_id',
  'number',
  'title',
  'status',
  'entity_id',
  'currency',
  'total_minor',
  'line_count',
] as const;

const PO_EXPORT_HEADERS = [
  'po_id',
  'number',
  'title',
  'status',
  'vendor_id',
  'entity_id',
  'contract_id',
  'purchase_request_id',
  'currency',
  'total_minor',
  'issued_at',
  'line_count',
] as const;

@Injectable()
export class IntegrationService {
  private readonly storageRoot = path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? 'storage/uploads',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

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
        key: 'contracts-export',
        name: 'Contracts export',
        direction: 'export',
        format: 'csv',
        headers: [...CONTRACT_EXPORT_HEADERS],
        module: 'contracts',
      },
      {
        key: 'purchase-requests-export',
        name: 'Purchase requests export',
        direction: 'export',
        format: 'csv',
        headers: [...PR_EXPORT_HEADERS],
        module: 'purchase_requests',
      },
      {
        key: 'purchase-orders-export',
        name: 'Purchase orders export',
        direction: 'export',
        format: 'csv',
        headers: [...PO_EXPORT_HEADERS],
        module: 'purchase_orders',
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

  listConnectorPacks() {
    return [
      {
        key: DEMO_ERP_PACK_KEY,
        name: 'Demo ERP',
        status: 'available',
        description:
          'Sandbox connector (mock OAuth). Connect, then sync approved invoices as a stub push job.',
      },
      {
        key: NETSUITE_PACK_KEY,
        name: 'NetSuite',
        status: 'available',
        description:
          'Push approved invoices as vendor-bill stubs. Mock connect for local/dev; live mode stores TBA/OAuth client settings (SuiteTalk call deferred).',
      },
      {
        key: 'quickbooks',
        name: 'QuickBooks Online',
        status: 'planned',
        description: 'Bills and vendors via Intuit OAuth (later connector pack).',
      },
      {
        key: 'xero',
        name: 'Xero',
        status: 'planned',
        description: 'Accounts payable bills via Xero OAuth (later connector pack).',
      },
      {
        key: 'sap-b1',
        name: 'SAP Business One',
        status: 'planned',
        description: 'Service Layer draft documents (later connector pack).',
      },
    ];
  }

  async listConnections(tenantId: string) {
    const rows = await this.prisma.connectorConnection.findMany({
      where: { tenantId },
      orderBy: { packKey: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      packKey: row.packKey,
      status: row.status,
      settings: row.settings,
      connectedAt: row.connectedAt,
      disconnectedAt: row.disconnectedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      hasCredentials: Boolean(row.credentialsHash),
    }));
  }

  async connectDemoErp(tenantId: string, userId: string) {
    const accessToken = `demo_${randomBytes(24).toString('base64url')}`;
    const now = new Date();
    const row = await this.prisma.connectorConnection.upsert({
      where: {
        tenantId_packKey: { tenantId, packKey: DEMO_ERP_PACK_KEY },
      },
      create: {
        tenantId,
        packKey: DEMO_ERP_PACK_KEY,
        status: 'connected',
        credentialsHash: hashSecret(accessToken),
        settings: { mode: 'mock', accountId: 'DEMO-001' },
        connectedAt: now,
        disconnectedAt: null,
        createdById: userId,
      },
      update: {
        status: 'connected',
        credentialsHash: hashSecret(accessToken),
        settings: { mode: 'mock', accountId: 'DEMO-001' },
        connectedAt: now,
        disconnectedAt: null,
        createdById: userId,
      },
    });

    return {
      id: row.id,
      packKey: row.packKey,
      status: row.status,
      settings: row.settings,
      connectedAt: row.connectedAt,
      /** Shown once — mock ERP access token */
      accessToken,
    };
  }

  async disconnectDemoErp(tenantId: string) {
    const existing = await this.prisma.connectorConnection.findUnique({
      where: {
        tenantId_packKey: { tenantId, packKey: DEMO_ERP_PACK_KEY },
      },
    });
    if (!existing) {
      throw new NotFoundException('Demo ERP connection not found');
    }
    return this.prisma.connectorConnection.update({
      where: { id: existing.id },
      data: {
        status: 'disconnected',
        credentialsHash: null,
        disconnectedAt: new Date(),
      },
      select: {
        id: true,
        packKey: true,
        status: true,
        disconnectedAt: true,
      },
    });
  }

  async syncDemoErp(tenantId: string, userId: string) {
    const connection = await this.prisma.connectorConnection.findUnique({
      where: {
        tenantId_packKey: { tenantId, packKey: DEMO_ERP_PACK_KEY },
      },
    });
    if (!connection || connection.status !== 'connected' || !connection.credentialsHash) {
      throw new BadRequestException(
        'Connect Demo ERP before running sync',
      );
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: 'approved' },
      orderBy: { approvedAt: 'asc' },
    });

    const lines = [
      [
        'invoice_id',
        'invoice_number',
        'total_minor',
        'currency',
        'approved_at',
        'erp_external_id',
      ].join(','),
    ];
    for (const inv of invoices) {
      lines.push(
        [
          inv.id,
          csv(inv.invoiceNumber),
          String(inv.totalMinor ?? ''),
          csv(inv.currency),
          inv.approvedAt?.toISOString() ?? '',
          `DEMO-${inv.id.slice(0, 8)}`,
        ].join(','),
      );
    }
    const content = `${lines.join('\n')}\n`;
    const fileName = `demo-erp-sync-${Date.now()}.csv`;

    try {
      const result = await this.finishExport({
        tenantId,
        userId,
        type: 'sync_demo_erp',
        fileName,
        content,
        rowCount: invoices.length,
        afterWrite: async () => {
          await this.prisma.invoice.updateMany({
            where: {
              tenantId,
              status: 'approved',
              exportedAt: null,
            },
            data: { exportedAt: new Date() },
          });
        },
      });
      return {
        job: result.job,
        packKey: DEMO_ERP_PACK_KEY,
        rowCount: result.rowCount,
        fileName: result.fileName,
        message: `Pushed ${result.rowCount} approved invoice(s) to Demo ERP (mock)`,
      };
    } catch (err) {
      const job = await this.prisma.integrationJob.create({
        data: {
          tenantId,
          type: 'sync_demo_erp',
          status: 'failed',
          rowCount: 0,
          errorMessage: err instanceof Error ? err.message : 'Sync failed',
          createdById: userId,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException({
        message: 'Demo ERP sync failed',
        jobId: job.id,
      });
    }
  }

  async connectNetsuite(
    tenantId: string,
    userId: string,
    input: {
      accountId?: string;
      mode?: 'mock' | 'live';
      clientId?: string;
      clientSecret?: string;
      tokenId?: string;
      tokenSecret?: string;
    },
  ) {
    const mode = input.mode === 'live' ? 'live' : 'mock';
    const accountId = (input.accountId ?? 'TSTDRV0000000').trim();
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    let accessToken: string | undefined;
    let credentialsHash: string;

    if (mode === 'mock') {
      accessToken = `ns_${randomBytes(24).toString('base64url')}`;
      credentialsHash = hashSecret(accessToken);
    } else {
      const clientId = input.clientId?.trim();
      const clientSecret = input.clientSecret?.trim();
      if (!clientId || !clientSecret) {
        throw new BadRequestException(
          'live mode requires clientId and clientSecret (TBA consumer key/secret)',
        );
      }
      // Store hash of consumer + token material; SuiteTalk call deferred to later epic
      const material = [
        clientId,
        clientSecret,
        input.tokenId?.trim() ?? '',
        input.tokenSecret?.trim() ?? '',
      ].join(':');
      credentialsHash = hashSecret(material);
    }

    const settings = {
      mode,
      accountId,
      clientIdSet: mode === 'live' ? Boolean(input.clientId?.trim()) : false,
      tokenIdSet: mode === 'live' ? Boolean(input.tokenId?.trim()) : false,
    } satisfies Prisma.InputJsonObject;

    const now = new Date();
    const row = await this.prisma.connectorConnection.upsert({
      where: {
        tenantId_packKey: { tenantId, packKey: NETSUITE_PACK_KEY },
      },
      create: {
        tenantId,
        packKey: NETSUITE_PACK_KEY,
        status: 'connected',
        credentialsHash,
        settings,
        connectedAt: now,
        disconnectedAt: null,
        createdById: userId,
      },
      update: {
        status: 'connected',
        credentialsHash,
        settings,
        connectedAt: now,
        disconnectedAt: null,
        createdById: userId,
      },
    });

    return {
      id: row.id,
      packKey: row.packKey,
      status: row.status,
      settings: row.settings,
      connectedAt: row.connectedAt,
      ...(accessToken ? { accessToken } : {}),
      message:
        mode === 'mock'
          ? 'NetSuite connected in mock mode'
          : 'NetSuite credentials stored (live SuiteTalk push still stubbed on sync)',
    };
  }

  async disconnectNetsuite(tenantId: string) {
    const existing = await this.prisma.connectorConnection.findUnique({
      where: {
        tenantId_packKey: { tenantId, packKey: NETSUITE_PACK_KEY },
      },
    });
    if (!existing) {
      throw new NotFoundException('NetSuite connection not found');
    }
    return this.prisma.connectorConnection.update({
      where: { id: existing.id },
      data: {
        status: 'disconnected',
        credentialsHash: null,
        disconnectedAt: new Date(),
      },
      select: {
        id: true,
        packKey: true,
        status: true,
        disconnectedAt: true,
      },
    });
  }

  async syncNetsuite(tenantId: string, userId: string) {
    const connection = await this.prisma.connectorConnection.findUnique({
      where: {
        tenantId_packKey: { tenantId, packKey: NETSUITE_PACK_KEY },
      },
    });
    if (!connection || connection.status !== 'connected' || !connection.credentialsHash) {
      throw new BadRequestException('Connect NetSuite before running sync');
    }

    const settings = (connection.settings ?? {}) as Record<string, unknown>;
    const mode = settings.mode === 'live' ? 'live' : 'mock';
    const accountId =
      typeof settings.accountId === 'string' ? settings.accountId : 'unknown';

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: 'approved' },
      orderBy: { approvedAt: 'asc' },
    });

    const lines = [
      [
        'invoice_id',
        'invoice_number',
        'total_minor',
        'currency',
        'approved_at',
        'netsuite_account',
        'vendor_bill_external_id',
        'mode',
      ].join(','),
    ];
    for (const inv of invoices) {
      lines.push(
        [
          inv.id,
          csv(inv.invoiceNumber),
          String(inv.totalMinor ?? ''),
          csv(inv.currency),
          inv.approvedAt?.toISOString() ?? '',
          csv(accountId),
          `NS-VB-${inv.id.slice(0, 8)}`,
          mode,
        ].join(','),
      );
    }
    const content = `${lines.join('\n')}\n`;
    const fileName = `netsuite-sync-${Date.now()}.csv`;

    try {
      const result = await this.finishExport({
        tenantId,
        userId,
        type: 'sync_netsuite',
        fileName,
        content,
        rowCount: invoices.length,
        afterWrite: async () => {
          await this.prisma.invoice.updateMany({
            where: {
              tenantId,
              status: 'approved',
              exportedAt: null,
            },
            data: { exportedAt: new Date() },
          });
        },
      });
      return {
        job: result.job,
        packKey: NETSUITE_PACK_KEY,
        rowCount: result.rowCount,
        fileName: result.fileName,
        mode,
        message:
          mode === 'mock'
            ? `Stub-pushed ${result.rowCount} vendor bill(s) to NetSuite (mock)`
            : `Recorded ${result.rowCount} vendor bill stub(s) for account ${accountId} (live SuiteTalk deferred)`,
      };
    } catch (err) {
      const job = await this.prisma.integrationJob.create({
        data: {
          tenantId,
          type: 'sync_netsuite',
          status: 'failed',
          rowCount: 0,
          errorMessage: err instanceof Error ? err.message : 'Sync failed',
          createdById: userId,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException({
        message: 'NetSuite sync failed',
        jobId: job.id,
      });
    }
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
          inv.purchaseOrderId ?? '',
        ].join(','),
      );
    }
    const content = `${lines.join('\n')}\n`;
    const fileName = `approved-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    return this.finishExport({
      tenantId,
      userId,
      type: 'export_approved_invoices',
      fileName,
      content,
      rowCount: invoices.length,
      afterWrite: async () => {
        if (invoices.length > 0) {
          await this.prisma.invoice.updateMany({
            where: { id: { in: invoices.map((i) => i.id) } },
            data: { status: 'exported', exportedAt: new Date() },
          });
        }
      },
    });
  }

  async exportContracts(tenantId: string, userId: string) {
    await this.assertModule(tenantId, 'contracts');
    const rows = await this.prisma.contract.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const lines = [CONTRACT_EXPORT_HEADERS.join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          csv(row.number),
          csv(row.title),
          row.status,
          row.vendorId ?? '',
          row.entityId ?? '',
          row.currency,
          row.valueMinor ?? '',
          row.startDate?.toISOString().slice(0, 10) ?? '',
          row.endDate?.toISOString().slice(0, 10) ?? '',
        ].join(','),
      );
    }
    return this.finishExport({
      tenantId,
      userId,
      type: 'export_contracts',
      fileName: `contracts-${new Date().toISOString().slice(0, 10)}.csv`,
      content: `${lines.join('\n')}\n`,
      rowCount: rows.length,
    });
  }

  async exportPurchaseRequests(tenantId: string, userId: string) {
    await this.assertModule(tenantId, 'purchase_requests');
    const rows = await this.prisma.purchaseRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { lines: true },
    });
    const lines = [PR_EXPORT_HEADERS.join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          csv(row.number),
          csv(row.title),
          row.status,
          row.entityId ?? '',
          row.currency,
          row.totalMinor ?? '',
          row.lines.length,
        ].join(','),
      );
    }
    return this.finishExport({
      tenantId,
      userId,
      type: 'export_purchase_requests',
      fileName: `purchase-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      content: `${lines.join('\n')}\n`,
      rowCount: rows.length,
    });
  }

  async exportPurchaseOrders(tenantId: string, userId: string) {
    await this.assertModule(tenantId, 'purchase_orders');
    const rows = await this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { lines: true },
    });
    const lines = [PO_EXPORT_HEADERS.join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          csv(row.number),
          csv(row.title),
          row.status,
          row.vendorId ?? '',
          row.entityId ?? '',
          row.contractId ?? '',
          row.purchaseRequestId ?? '',
          row.currency,
          row.totalMinor ?? '',
          row.issuedAt?.toISOString() ?? '',
          row.lines.length,
        ].join(','),
      );
    }
    return this.finishExport({
      tenantId,
      userId,
      type: 'export_purchase_orders',
      fileName: `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      content: `${lines.join('\n')}\n`,
      rowCount: rows.length,
    });
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

  private async assertModule(tenantId: string, moduleKey: ModuleKey) {
    const enabled = await this.tenancy.isModuleEnabled(tenantId, moduleKey);
    if (!enabled) {
      throw new ForbiddenException(`Module "${moduleKey}" is not licensed`);
    }
  }

  private async finishExport(input: {
    tenantId: string;
    userId: string;
    type: IntegrationJobType;
    fileName: string;
    content: string;
    rowCount: number;
    afterWrite?: () => Promise<void>;
  }) {
    const storagePath = await this.writeArtifact(
      input.tenantId,
      input.fileName,
      input.content,
    );
    const job = await this.prisma.integrationJob.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        status: 'succeeded',
        fileName: input.fileName,
        storagePath,
        rowCount: input.rowCount,
        createdById: input.userId,
        finishedAt: new Date(),
      },
    });
    if (input.afterWrite) await input.afterWrite();
    return {
      job,
      fileName: input.fileName,
      content: input.content,
      rowCount: input.rowCount,
    };
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
