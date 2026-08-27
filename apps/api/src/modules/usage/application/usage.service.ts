import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { BILLABLE_EVENT_INVOICE_APPROVED } from '@aptora/types';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordInvoiceApproved(tenantId: string, invoiceId: string) {
    return this.prisma.usageEvent.upsert({
      where: {
        tenantId_type_refId: {
          tenantId,
          type: BILLABLE_EVENT_INVOICE_APPROVED,
          refId: invoiceId,
        },
      },
      create: {
        tenantId,
        type: BILLABLE_EVENT_INVOICE_APPROVED,
        refId: invoiceId,
      },
      update: {},
    });
  }

  async incrementOcrPages(tenantId: string, pages: number) {
    const yearMonth = new Date().toISOString().slice(0, 7);
    return this.prisma.ocrPageMeter.upsert({
      where: { tenantId_yearMonth: { tenantId, yearMonth } },
      create: { tenantId, yearMonth, pages },
      update: { pages: { increment: pages } },
    });
  }

  async getUsageSummary(tenantId: string) {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const [approvedCount, ocr] = await Promise.all([
      this.prisma.usageEvent.count({
        where: { tenantId, type: BILLABLE_EVENT_INVOICE_APPROVED },
      }),
      this.prisma.ocrPageMeter.findUnique({
        where: { tenantId_yearMonth: { tenantId, yearMonth } },
      }),
    ]);
    return {
      approvedInvoices: approvedCount,
      ocrPagesThisMonth: ocr?.pages ?? 0,
      yearMonth,
    };
  }
}
