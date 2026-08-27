import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { UsageService } from '../../usage/application/usage.service';
import { WorkflowService } from '../../workflow/application/workflow.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly workflow: WorkflowService,
  ) {}

  list(tenantId: string, status?: InvoiceStatus) {
    return this.prisma.invoice.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        fileAsset: true,
        exceptions: { where: { resolved: false } },
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  async get(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      vendorId?: string | null;
      vendorNameRaw?: string | null;
      invoiceNumber?: string | null;
      invoiceDate?: string | null;
      dueDate?: string | null;
      currency?: string;
      subtotalMinor?: number | null;
      taxMinor?: number | null;
      totalMinor?: number | null;
      notes?: string | null;
    },
  ) {
    await this.get(tenantId, id);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        vendorId: data.vendorId,
        vendorNameRaw: data.vendorNameRaw,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : data.invoiceDate === null ? null : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
        currency: data.currency,
        subtotalMinor: data.subtotalMinor,
        taxMinor: data.taxMinor,
        totalMinor: data.totalMinor,
        notes: data.notes,
      },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
  }

  async resolveExceptions(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.invoiceException.updateMany({
      where: { invoiceId: id, resolved: false },
      data: { resolved: true },
    });
    return this.get(tenantId, id);
  }

  async submit(tenantId: string, id: string, actorUserId: string) {
    return this.workflow.submitInvoice(tenantId, id, actorUserId);
  }

  async approve(tenantId: string, id: string) {
    const invoice = await this.get(tenantId, id);
    if (['void', 'exported'].includes(invoice.status)) {
      throw new BadRequestException(`Cannot approve invoice in status ${invoice.status}`);
    }
    if (invoice.totalMinor == null) {
      throw new BadRequestException('Total amount is required before approval');
    }
    if (!invoice.invoiceNumber) {
      throw new BadRequestException('Invoice number is required before approval');
    }

    const usage = await this.usage.getUsageSummary(tenantId);
    if (usage.hardBlocked) {
      throw new BadRequestException(
        `Approved invoice hard limit reached (${usage.approvedHardLimit} MTD)`,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        exceptions: {
          updateMany: {
            where: { resolved: false },
            data: { resolved: true },
          },
        },
      },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });

    await this.usage.recordInvoiceApproved(tenantId, id);
    return updated;
  }

  async void(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'void' },
      include: {
        fileAsset: true,
        exceptions: true,
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
  }
}
