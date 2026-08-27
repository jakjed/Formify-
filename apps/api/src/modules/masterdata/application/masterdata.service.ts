import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlAccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  resolveEntityScope,
  scopedEntityWhere,
} from '../../../common/entity-scope';

type ListOpts = {
  includeInactive?: boolean;
  entityId?: string | null;
  q?: string;
  accountType?: GlAccountType;
  userId?: string;
  role?: string;
};

@Injectable()
export class MasterdataService {
  constructor(private readonly prisma: PrismaService) {}

  private async scope(
    tenantId: string,
    opts: ListOpts,
  ): Promise<ReturnType<typeof scopedEntityWhere> | Record<string, never>> {
    if (!opts.userId || !opts.role) {
      if (opts.entityId && opts.entityId !== 'all') {
        return { entityId: opts.entityId };
      }
      return {};
    }
    const scope = await resolveEntityScope(
      this.prisma,
      tenantId,
      opts.userId,
      opts.role,
      opts.entityId,
    );
    return scopedEntityWhere(scope);
  }

  private textSearch(
    q: string | undefined,
    fields: string[],
  ): Prisma.Enumerable<Record<string, unknown>> | undefined {
    const term = q?.trim();
    if (!term) return undefined;
    return fields.map((field) => ({
      [field]: { contains: term, mode: 'insensitive' },
    }));
  }

  // --- Vendors ---
  async listVendors(tenantId: string, opts: ListOpts = {}) {
    const entityWhere = await this.scope(tenantId, opts);
    const or = this.textSearch(opts.q, ['code', 'name', 'email', 'taxId']);
    return this.prisma.vendor.findMany({
      where: {
        tenantId,
        ...(opts.includeInactive ? {} : { active: true }),
        ...entityWhere,
        ...(or ? { OR: or as Prisma.VendorWhereInput[] } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        entity: { select: { id: true, code: true, name: true } },
        paymentTerm: { select: { id: true, code: true, name: true } },
        taxCode: { select: { id: true, code: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true, accountType: true } },
      },
    });
  }

  async getVendor(tenantId: string, id: string) {
    const row = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
      include: {
        entity: { select: { id: true, code: true, name: true } },
        paymentTerm: { select: { id: true, code: true, name: true } },
        taxCode: { select: { id: true, code: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true, accountType: true } },
      },
    });
    if (!row) throw new NotFoundException('Vendor not found');
    return row;
  }

  async createVendor(
    tenantId: string,
    data: {
      code: string;
      name: string;
      entityId?: string;
      email?: string;
      taxId?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      bankName?: string;
      bankAccount?: string;
      bankIban?: string;
      bankSwift?: string;
      paymentTermId?: string;
      taxCodeId?: string;
      glAccountId?: string;
      externalId?: string;
    },
  ) {
    if (data.glAccountId) {
      await this.assertLiabilityGl(tenantId, data.glAccountId);
    }
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    try {
      return await this.prisma.vendor.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          entityId: data.entityId,
          email: data.email?.toLowerCase(),
          taxId: data.taxId,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          region: data.region,
          postalCode: data.postalCode,
          country: data.country,
          bankName: data.bankName,
          bankAccount: data.bankAccount,
          bankIban: data.bankIban,
          bankSwift: data.bankSwift,
          paymentTermId: data.paymentTermId,
          taxCodeId: data.taxCodeId,
          glAccountId: data.glAccountId,
          externalId: data.externalId,
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
          paymentTerm: { select: { id: true, code: true, name: true } },
          taxCode: { select: { id: true, code: true, name: true } },
          glAccount: {
            select: { id: true, code: true, name: true, accountType: true },
          },
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
      entityId?: string | null;
      email?: string;
      taxId?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      bankName?: string;
      bankAccount?: string;
      bankIban?: string;
      bankSwift?: string;
      paymentTermId?: string | null;
      taxCodeId?: string | null;
      glAccountId?: string | null;
      externalId?: string;
      active?: boolean;
    },
  ) {
    await this.getVendor(tenantId, id);
    if (data.glAccountId) {
      await this.assertLiabilityGl(tenantId, data.glAccountId);
    }
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        entityId: data.entityId,
        email: data.email?.toLowerCase(),
        taxId: data.taxId,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        region: data.region,
        postalCode: data.postalCode,
        country: data.country,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankIban: data.bankIban,
        bankSwift: data.bankSwift,
        paymentTermId: data.paymentTermId,
        taxCodeId: data.taxCodeId,
        glAccountId: data.glAccountId,
        externalId: data.externalId,
        active: data.active,
      },
      include: {
        entity: { select: { id: true, code: true, name: true } },
        paymentTerm: { select: { id: true, code: true, name: true } },
        taxCode: { select: { id: true, code: true, name: true } },
        glAccount: {
          select: { id: true, code: true, name: true, accountType: true },
        },
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
  async listGlAccounts(tenantId: string, opts: ListOpts = {}) {
    const entityWhere = await this.scope(tenantId, opts);
    const or = this.textSearch(opts.q, ['code', 'name']);
    return this.prisma.glAccount.findMany({
      where: {
        tenantId,
        ...(opts.includeInactive ? {} : { active: true }),
        ...(opts.accountType ? { accountType: opts.accountType } : {}),
        ...entityWhere,
        ...(or ? { OR: or as Prisma.GlAccountWhereInput[] } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createGlAccount(
    tenantId: string,
    data: {
      code: string;
      name: string;
      entityId?: string;
      accountType?: GlAccountType;
    },
  ) {
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    try {
      return await this.prisma.glAccount.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          entityId: data.entityId,
          accountType: data.accountType ?? 'expense',
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'GL account code already exists');
    }
  }

  async updateGlAccount(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      entityId?: string | null;
      accountType?: GlAccountType;
      active?: boolean;
    },
  ) {
    const row = await this.prisma.glAccount.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('GL account not found');
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    return this.prisma.glAccount.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        entityId: data.entityId,
        accountType: data.accountType,
        active: data.active,
      },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // --- Cost centers ---
  async listCostCenters(tenantId: string, opts: ListOpts = {}) {
    const entityWhere = await this.scope(tenantId, opts);
    const or = this.textSearch(opts.q, ['code', 'name']);
    return this.prisma.costCenter.findMany({
      where: {
        tenantId,
        ...(opts.includeInactive ? {} : { active: true }),
        ...entityWhere,
        ...(or ? { OR: or as Prisma.CostCenterWhereInput[] } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createCostCenter(
    tenantId: string,
    data: { code: string; name: string; entityId?: string },
  ) {
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    try {
      return await this.prisma.costCenter.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          entityId: data.entityId,
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Cost center code already exists');
    }
  }

  async updateCostCenter(
    tenantId: string,
    id: string,
    data: { name?: string; entityId?: string | null; active?: boolean },
  ) {
    const row = await this.prisma.costCenter.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Cost center not found');
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    return this.prisma.costCenter.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        entityId: data.entityId,
        active: data.active,
      },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // --- Tax codes ---
  async listTaxCodes(tenantId: string, opts: ListOpts = {}) {
    const entityWhere = await this.scope(tenantId, opts);
    const or = this.textSearch(opts.q, ['code', 'name']);
    return this.prisma.taxCode.findMany({
      where: {
        tenantId,
        ...(opts.includeInactive ? {} : { active: true }),
        ...entityWhere,
        ...(or ? { OR: or as Prisma.TaxCodeWhereInput[] } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createTaxCode(
    tenantId: string,
    data: { code: string; name: string; rateBps: number; entityId?: string },
  ) {
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    try {
      return await this.prisma.taxCode.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          rateBps: data.rateBps,
          entityId: data.entityId,
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Tax code already exists');
    }
  }

  async updateTaxCode(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      rateBps?: number;
      entityId?: string | null;
      active?: boolean;
    },
  ) {
    const row = await this.prisma.taxCode.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Tax code not found');
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    return this.prisma.taxCode.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        rateBps: data.rateBps,
        entityId: data.entityId,
        active: data.active,
      },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // --- Payment terms ---
  async listPaymentTerms(tenantId: string, opts: ListOpts = {}) {
    const entityWhere = await this.scope(tenantId, opts);
    const or = this.textSearch(opts.q, ['code', 'name']);
    return this.prisma.paymentTerm.findMany({
      where: {
        tenantId,
        ...(opts.includeInactive ? {} : { active: true }),
        ...entityWhere,
        ...(or ? { OR: or as Prisma.PaymentTermWhereInput[] } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createPaymentTerm(
    tenantId: string,
    data: { code: string; name: string; netDays: number; entityId?: string },
  ) {
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    try {
      return await this.prisma.paymentTerm.create({
        data: {
          tenantId,
          code: data.code.trim(),
          name: data.name.trim(),
          netDays: data.netDays,
          entityId: data.entityId,
        },
        include: {
          entity: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Payment term code already exists');
    }
  }

  async updatePaymentTerm(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      netDays?: number;
      entityId?: string | null;
      active?: boolean;
    },
  ) {
    const row = await this.prisma.paymentTerm.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Payment term not found');
    if (data.entityId) await this.assertEntity(tenantId, data.entityId);
    return this.prisma.paymentTerm.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        netDays: data.netDays,
        entityId: data.entityId,
        active: data.active,
      },
      include: {
        entity: { select: { id: true, code: true, name: true } },
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

  private async assertEntity(tenantId: string, entityId: string) {
    const ent = await this.prisma.entity.findFirst({
      where: { id: entityId, tenantId },
    });
    if (!ent) throw new BadRequestException('Entity not found');
  }

  private async assertLiabilityGl(tenantId: string, glAccountId: string) {
    const gl = await this.prisma.glAccount.findFirst({
      where: { id: glAccountId, tenantId },
    });
    if (!gl) throw new BadRequestException('GL account not found');
    if (gl.accountType !== 'liability') {
      throw new BadRequestException(
        'Vendor GL account must be of type Liability',
      );
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
