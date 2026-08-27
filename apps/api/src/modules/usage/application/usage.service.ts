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
    const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
    const [approvedTotal, approvedMtd, ocr, tenant] = await Promise.all([
      this.prisma.usageEvent.count({
        where: { tenantId, type: BILLABLE_EVENT_INVOICE_APPROVED },
      }),
      this.prisma.usageEvent.count({
        where: {
          tenantId,
          type: BILLABLE_EVENT_INVOICE_APPROVED,
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.ocrPageMeter.findUnique({
        where: { tenantId_yearMonth: { tenantId, yearMonth } },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    const soft = tenant?.approvedSoftLimit ?? null;
    const hard = tenant?.approvedHardLimit ?? null;
    const softWarned =
      soft != null ? approvedMtd >= soft : false;
    const hardBlocked =
      hard != null ? approvedMtd >= hard : false;

    return {
      approvedInvoices: approvedTotal,
      approvedInvoicesMtd: approvedMtd,
      ocrPagesThisMonth: ocr?.pages ?? 0,
      yearMonth,
      planName: tenant?.planName ?? 'starter',
      approvedSoftLimit: soft,
      approvedHardLimit: hard,
      softWarned,
      hardBlocked,
    };
  }
}
