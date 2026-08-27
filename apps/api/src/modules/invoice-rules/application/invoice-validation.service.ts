import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenancyService } from '../../tenancy/application/tenancy.service';

export type ValidationIssue = {
  code: string;
  message: string;
  blocking: boolean;
};

export type ValidationResult = {
  invoiceId: string;
  ok: boolean;
  blocking: boolean;
  issues: ValidationIssue[];
  duplicateOfId: string | null;
};

/** Codes managed by the validation engine (re-synced on each run). */
export const MANAGED_EXCEPTION_CODES = [
  'DUP',
  'VENDOR_UNMATCHED',
  'CODING',
  'TAX',
  'ENTITY',
  'PO_TOTAL',
  'PO_VENDOR',
  'PO_RECEIPT',
] as const;

const TOTAL_TOLERANCE_MINOR = 1; // 1 cent
const DUP_LOOKBACK_DAYS = 365;
const PO_TOTAL_TOLERANCE_MINOR = 1;

@Injectable()
export class InvoiceValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  async evaluate(tenantId: string, invoiceId: string): Promise<ValidationResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: true },
    });
    if (!invoice) {
      return {
        invoiceId,
        ok: false,
        blocking: true,
        issues: [
          {
            code: 'CODING',
            message: 'Invoice not found',
            blocking: true,
          },
        ],
        duplicateOfId: null,
      };
    }

    const issues: ValidationIssue[] = [];
    let duplicateOfId: string | null = null;

    if (!invoice.invoiceNumber?.trim()) {
      issues.push({
        code: 'CODING',
        message: 'Invoice number is required',
        blocking: true,
      });
    }
    if (invoice.totalMinor == null) {
      issues.push({
        code: 'CODING',
        message: 'Total amount is required',
        blocking: true,
      });
    }
    if (!invoice.currency?.trim()) {
      issues.push({
        code: 'CODING',
        message: 'Currency is required',
        blocking: true,
      });
    }
    if (!invoice.entityId) {
      issues.push({
        code: 'ENTITY',
        message: 'Entity is required',
        blocking: true,
      });
    }
    if (!invoice.vendorId) {
      issues.push({
        code: 'VENDOR_UNMATCHED',
        message: 'Vendor master match is required before submit',
        blocking: true,
      });
    }

    if (
      invoice.totalMinor != null &&
      invoice.subtotalMinor != null &&
      invoice.taxMinor != null
    ) {
      const sum = invoice.subtotalMinor + invoice.taxMinor;
      if (Math.abs(sum - invoice.totalMinor) > TOTAL_TOLERANCE_MINOR) {
        issues.push({
          code: 'TAX',
          message: `Total ${invoice.totalMinor} does not equal subtotal+tax ${sum} (tolerance ${TOTAL_TOLERANCE_MINOR})`,
          blocking: true,
        });
      }
    }

    if (invoice.invoiceNumber?.trim()) {
      const since = new Date(
        Date.now() - DUP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      );
      const vendorFilters = [
        ...(invoice.vendorId ? [{ vendorId: invoice.vendorId }] : []),
        ...(invoice.vendorNameRaw
          ? [
              {
                vendorNameRaw: {
                  equals: invoice.vendorNameRaw.trim(),
                  mode: 'insensitive' as const,
                },
              },
            ]
          : []),
      ];

      const duplicate = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          id: { not: invoiceId },
          status: { notIn: ['void'] },
          invoiceNumber: {
            equals: invoice.invoiceNumber.trim(),
            mode: 'insensitive',
          },
          createdAt: { gte: since },
          ...(vendorFilters.length > 0 ? { OR: vendorFilters } : {}),
        },
        select: { id: true, invoiceNumber: true, status: true },
        orderBy: { createdAt: 'desc' },
      });

      if (duplicate) {
        duplicateOfId = duplicate.id;
        issues.push({
          code: 'DUP',
          message: `Possible duplicate of invoice ${duplicate.invoiceNumber ?? duplicate.id.slice(0, 8)} (${duplicate.status})`,
          blocking: true,
        });
      }
    }

    const poLicensed = await this.tenancy.isModuleEnabled(
      tenantId,
      'purchase_orders',
    );
    if (poLicensed && invoice.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: invoice.purchaseOrderId, tenantId },
        include: { lines: true },
      });
      if (!po) {
        issues.push({
          code: 'PO_TOTAL',
          message: 'Linked purchase order not found',
          blocking: true,
        });
      } else {
        if (
          invoice.vendorId &&
          po.vendorId &&
          invoice.vendorId !== po.vendorId
        ) {
          issues.push({
            code: 'PO_VENDOR',
            message: 'Invoice vendor does not match purchase order vendor',
            blocking: true,
          });
        }

        const poTotal =
          po.totalMinor ??
          po.lines.reduce((sum, line) => {
            if (line.amountMinor != null) return sum + line.amountMinor;
            if (line.unitPriceMinor != null && line.quantity != null) {
              return sum + Math.round(line.unitPriceMinor * line.quantity);
            }
            return sum;
          }, 0);

        if (invoice.totalMinor != null && poTotal > 0) {
          if (
            Math.abs(invoice.totalMinor - poTotal) > PO_TOTAL_TOLERANCE_MINOR
          ) {
            issues.push({
              code: 'PO_TOTAL',
              message: `2-way match failed: invoice total ${invoice.totalMinor} vs PO ${poTotal} (±${PO_TOTAL_TOLERANCE_MINOR})`,
              blocking: true,
            });
          }
        }

        const receiptOk = ['partially_received', 'received', 'closed'].includes(
          po.status,
        );
        if (!receiptOk) {
          issues.push({
            code: 'PO_RECEIPT',
            message: `3-way match failed: PO ${po.number} is ${po.status} (needs receipt)`,
            blocking: true,
          });
        }
      }
    }

    const blocking = issues.some((i) => i.blocking);
    return {
      invoiceId,
      ok: issues.length === 0,
      blocking,
      issues,
      duplicateOfId,
    };
  }

  /**
   * Recompute managed exceptions from current invoice fields.
   * Preserves OCR_* and other non-managed codes.
   */
  async syncExceptions(tenantId: string, invoiceId: string) {
    const result = await this.evaluate(tenantId, invoiceId);

    await this.prisma.invoiceException.deleteMany({
      where: {
        invoiceId,
        code: { in: [...MANAGED_EXCEPTION_CODES] },
      },
    });

    if (result.issues.length > 0) {
      await this.prisma.invoiceException.createMany({
        data: result.issues.map((issue) => ({
          invoiceId,
          code: issue.code,
          message: issue.message,
          resolved: false,
        })),
      });
    }

    const openManaged = result.issues.filter((i) => i.blocking).length;
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (
      invoice &&
      openManaged > 0 &&
      ['needs_review', 'captured', 'extracting'].includes(invoice.status)
    ) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'exception' },
      });
    } else if (
      invoice &&
      openManaged === 0 &&
      invoice.status === 'exception'
    ) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'needs_review' },
      });
    }

    return result;
  }

  async assertReadyForApproval(tenantId: string, invoiceId: string) {
    const result = await this.syncExceptions(tenantId, invoiceId);
    if (result.blocking) {
      const summary = result.issues
        .filter((i) => i.blocking)
        .map((i) => i.code)
        .join(', ');
      return { ...result, summary };
    }
    return { ...result, summary: null as string | null };
  }
}
