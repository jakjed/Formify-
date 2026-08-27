import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MasterdataService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Vendors ---
  listVendors(tenantId: string, includeInactive = false) {
    return this.prisma.vendor.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { code: 'asc' },
    });
  }

  async getVendor(tenantId: string, id: string) {
    const row = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Vendor not found');
    return row;
  }

  async createVendor(
    tenantId: string,
    data: {
      code: string;
      name: string;
      email?: string;
      taxId?: string;
      paymentTermId?: string;
      externalId?: string;
    },
  ) {
    try {
      return await this.prisma.vendor.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          email: data.email?.toLowerCase(),
          taxId: data.taxId,
          paymentTermId: data.paymentTermId,
          externalId: data.externalId,
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Vendor code already exists');
    }
  }

  async updateVendor(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      email?: string;
      taxId?: string;
      paymentTermId?: string | null;
      externalId?: string;
      active?: boolean;
    },
  ) {
    await this.getVendor(tenantId, id);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        email: data.email?.toLowerCase(),
        taxId: data.taxId,
        paymentTermId: data.paymentTermId,
        externalId: data.externalId,
        active: data.active,
      },
    });
  }

  async deactivateVendor(tenantId: string, id: string) {
    await this.getVendor(tenantId, id);
    return this.prisma.vendor.update({
      where: { id },
      data: { active: false },
    });
  }

  // --- GL accounts ---
  listGlAccounts(tenantId: string, includeInactive = false) {
    return this.prisma.glAccount.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { code: 'asc' },
    });
  }

  async createGlAccount(tenantId: string, data: { code: string; name: string }) {
    try {
      return await this.prisma.glAccount.create({
        data: { tenantId, code: data.code.trim(), name: data.name.trim() },
      });
    } catch (err) {
      this.rethrowUnique(err, 'GL account code already exists');
    }
  }

  async updateGlAccount(
    tenantId: string,
    id: string,
    data: { name?: string; active?: boolean },
  ) {
    const row = await this.prisma.glAccount.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('GL account not found');
    return this.prisma.glAccount.update({
      where: { id },
      data: { name: data.name?.trim(), active: data.active },
    });
  }

  // --- Cost centers ---
  listCostCenters(tenantId: string, includeInactive = false) {
    return this.prisma.costCenter.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { code: 'asc' },
    });
  }

  async createCostCenter(tenantId: string, data: { code: string; name: string }) {
    try {
      return await this.prisma.costCenter.create({
        data: { tenantId, code: data.code.trim(), name: data.name.trim() },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Cost center code already exists');
    }
  }

  async updateCostCenter(
    tenantId: string,
    id: string,
    data: { name?: string; active?: boolean },
  ) {
    const row = await this.prisma.costCenter.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Cost center not found');
    return this.prisma.costCenter.update({
      where: { id },
      data: { name: data.name?.trim(), active: data.active },
    });
  }

  // --- Tax codes ---
  listTaxCodes(tenantId: string, includeInactive = false) {
    return this.prisma.taxCode.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { code: 'asc' },
    });
  }

  async createTaxCode(
    tenantId: string,
    data: { code: string; name: string; rateBps: number },
  ) {
    try {
      return await this.prisma.taxCode.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          rateBps: data.rateBps,
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Tax code already exists');
    }
  }

  async updateTaxCode(
    tenantId: string,
    id: string,
    data: { name?: string; rateBps?: number; active?: boolean },
  ) {
    const row = await this.prisma.taxCode.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Tax code not found');
    return this.prisma.taxCode.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        rateBps: data.rateBps,
        active: data.active,
      },
    });
  }

  // --- Payment terms ---
  listPaymentTerms(tenantId: string, includeInactive = false) {
    return this.prisma.paymentTerm.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { code: 'asc' },
    });
  }

  async createPaymentTerm(
    tenantId: string,
    data: { code: string; name: string; netDays: number },
  ) {
    try {
      return await this.prisma.paymentTerm.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          netDays: data.netDays,
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Payment term code already exists');
    }
  }

  async updatePaymentTerm(
    tenantId: string,
    id: string,
    data: { name?: string; netDays?: number; active?: boolean },
  ) {
    const row = await this.prisma.paymentTerm.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Payment term not found');
    return this.prisma.paymentTerm.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        netDays: data.netDays,
        active: data.active,
      },
    });
  }

  // --- Expense categories ---
  listExpenseCategories(tenantId: string, entityId?: string) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId, ...(entityId ? { entityId } : {}) },
      orderBy: [{ code: 'asc' }],
      include: {
        entity: { select: { id: true, code: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createExpenseCategory(
    tenantId: string,
    data: {
      code: string;
      name: string;
      entityId: string;
      glAccountId: string;
      keywords?: string;
    },
  ) {
    try {
      return await this.prisma.expenseCategory.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          entityId: data.entityId,
          glAccountId: data.glAccountId,
          keywords: data.keywords?.trim() ?? '',
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
          glAccount: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Expense category code already exists');
    }
  }

  async updateExpenseCategory(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      entityId?: string;
      glAccountId?: string;
      keywords?: string;
      active?: boolean;
    },
  ) {
    const row = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Expense category not found');
    try {
      return await this.prisma.expenseCategory.update({
        where: { id },
        data: {
          name: data.name?.trim(),
          entityId: data.entityId,
          glAccountId: data.glAccountId,
          keywords: data.keywords?.trim(),
          active: data.active,
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
          glAccount: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Expense category code already exists');
    }
  }

  private rethrowUnique(err: unknown, message: string): never {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw err;
  }
}
