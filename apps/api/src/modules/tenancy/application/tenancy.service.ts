import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import type {
  EntityRecord,
  EntityWriteInput,
  TenantRecord,
} from '../domain/tenancy.types';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(input: {
    name: string;
    slug: string;
    region?: 'us' | 'eu';
  }): Promise<TenantRecord> {
    try {
      const token = randomBytes(24).toString('hex');
      const devAllModules = process.env.NODE_ENV !== 'production';
      const tenant = await this.prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          region: input.region ?? 'us',
          moduleLicenses: {
            create: [
              { moduleKey: 'invoices', enabled: true },
              { moduleKey: 'contracts', enabled: devAllModules },
              { moduleKey: 'purchase_requests', enabled: devAllModules },
              { moduleKey: 'purchase_orders', enabled: devAllModules },
            ],
          },
          entities: {
            create: [{ name: `${input.name} Entity`, code: 'MAIN' }],
          },
          authProviders: {
            create: [
              { type: 'local', enabled: true, order: 1, settings: {} },
              { type: 'oidc', enabled: false, order: 2, settings: {} },
              { type: 'saml', enabled: false, order: 3, settings: {} },
            ],
          },
          approvalPolicies: {
            create: [
              {
                moduleKey: 'invoices',
                name: 'Default invoice policy',
                enabled: true,
                autoApproveUnderMinor: 10000, // €100.00
              },
              {
                moduleKey: 'contracts',
                name: 'Default contracts policy',
                enabled: true,
                chainJson: [
                  'Budget Owner',
                  'Legal',
                  'Tax',
                  'Compliance',
                  'Finance',
                ],
              },
              {
                moduleKey: 'purchase_requests',
                name: 'Default purchase request policy',
                enabled: true,
                chainJson: ['Budget Owner', 'Finance', 'CFO'],
              },
              {
                moduleKey: 'purchase_orders',
                name: 'Default purchase order policy',
                enabled: true,
                chainJson: ['AP Manager'],
              },
              {
                moduleKey: 'accruals',
                name: 'Default accruals policy',
                enabled: true,
                chainJson: ['AP Manager', 'Controller'],
              },
            ],
          },
          captureMailbox: {
            create: {
              address: `${input.slug}-invoices@inbound.procureledger.local`,
              token,
            },
          },
        },
        include: { moduleLicenses: true },
      });

      return this.toTenantRecord(tenant);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = err.meta?.target;
        const fields = Array.isArray(target)
          ? target.join(', ')
          : typeof target === 'string'
            ? target
            : 'unknown field';
        if (fields.includes('slug')) {
          throw new ConflictException(
            `Tenant slug "${input.slug}" already exists`,
          );
        }
        throw new ConflictException(
          `Could not create workspace (database constraint: ${fields})`,
        );
      }
      throw err;
    }
  }

  async getTenant(id: string): Promise<TenantRecord> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { moduleLicenses: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return this.toTenantRecord(tenant);
  }

  async listEntities(tenantId: string): Promise<EntityRecord[]> {
    await this.getTenant(tenantId);
    const entities = await this.prisma.entity.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
    return entities.map((e) => this.toEntityRecord(e));
  }

  /**
   * Admins always see every tenant entity (memberships apply to non-admins).
   * Non-admin with memberships → assigned entities only.
   * Non-admin without memberships → none.
   * Admin without memberships → all (bootstrap).
   */
  async listEntitiesFiltered(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<EntityRecord[]> {
    await this.getTenant(tenantId);
    if (role === 'admin') {
      return this.listEntities(tenantId);
    }
    const memberships = await this.prisma.userEntityMembership.findMany({
      where: { tenantId, userId },
      include: { entity: true },
      orderBy: { entity: { code: 'asc' } },
    });
    if (memberships.length > 0) {
      return memberships.map((m) => this.toEntityRecord(m.entity));
    }
    return [];
  }

  async createEntity(
    tenantId: string,
    input: EntityWriteInput & { name: string; code: string },
    createdByUserId?: string,
  ): Promise<EntityRecord> {
    await this.getTenant(tenantId);
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    const existing = await this.prisma.entity.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      throw new ConflictException(
        `Entity code "${code}" already exists as "${existing.name}". It is in the system — refresh the entity list (Admin → Entities or shell selector).`,
      );
    }

    try {
      const entity = await this.prisma.$transaction(async (tx) => {
        const created = await tx.entity.create({
          data: {
            tenantId,
            name,
            code,
            ...this.entityAddressData(input),
          },
        });
        if (createdByUserId) {
          await tx.userEntityMembership.upsert({
            where: {
              userId_entityId: {
                userId: createdByUserId,
                entityId: created.id,
              },
            },
            create: {
              tenantId,
              userId: createdByUserId,
              entityId: created.id,
            },
            update: {},
          });
        }
        return created;
      });
      return this.toEntityRecord(entity);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Entity code "${code}" already exists. Refresh the entity list.`,
        );
      }
      throw err;
    }
  }

  async updateEntity(
    tenantId: string,
    id: string,
    input: EntityWriteInput,
  ): Promise<EntityRecord> {
    const existing = await this.prisma.entity.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Entity not found');
    try {
      const entity = await this.prisma.entity.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          code: input.code?.trim().toUpperCase(),
          ...this.entityAddressData(input),
        },
      });
      return this.toEntityRecord(entity);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Entity code already exists`);
      }
      throw err;
    }
  }

  async getPlan(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    return {
      planName: tenant.planName,
      approvedSoftLimit: tenant.approvedSoftLimit,
      approvedHardLimit: tenant.approvedHardLimit,
    };
  }

  async updatePlan(
    tenantId: string,
    input: {
      planName?: string;
      approvedSoftLimit?: number | null;
      approvedHardLimit?: number | null;
    },
  ) {
    await this.getTenant(tenantId);
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planName: input.planName,
        approvedSoftLimit: input.approvedSoftLimit,
        approvedHardLimit: input.approvedHardLimit,
      },
    });
    return {
      planName: tenant.planName,
      approvedSoftLimit: tenant.approvedSoftLimit,
      approvedHardLimit: tenant.approvedHardLimit,
    };
  }

  async isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    const license = await this.prisma.moduleLicense.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });
    return Boolean(license?.enabled);
  }

  async listModules(tenantId: string) {
    await this.getTenant(tenantId);
    const rows = await this.prisma.moduleLicense.findMany({
      where: { tenantId },
      orderBy: { moduleKey: 'asc' },
    });
    return rows.map((r) => ({
      moduleKey: r.moduleKey,
      enabled: r.enabled,
    }));
  }

  async setModuleEnabled(
    tenantId: string,
    moduleKey: string,
    enabled: boolean,
  ) {
    await this.getTenant(tenantId);
    return this.prisma.moduleLicense.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      create: { tenantId, moduleKey, enabled },
      update: { enabled },
    });
  }

  async getAiSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { aiAssistEnabled: true, llmProvider: true },
    });
    return tenant;
  }

  async updateAiSettings(
    tenantId: string,
    input: { aiAssistEnabled?: boolean; llmProvider?: string },
  ) {
    await this.getTenant(tenantId);
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.aiAssistEnabled !== undefined
          ? { aiAssistEnabled: input.aiAssistEnabled }
          : {}),
        ...(input.llmProvider !== undefined
          ? { llmProvider: input.llmProvider }
          : {}),
      },
      select: { aiAssistEnabled: true, llmProvider: true },
    });
  }

  async joinWaitlist(email: string, company?: string) {
    const row = await this.prisma.waitlistSignup.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        company: company?.trim() || null,
      },
      update: {
        company: company?.trim() || null,
      },
    });
    return { ok: true, id: row.id };
  }

  async getOnboarding(tenantId: string) {
    await this.getTenant(tenantId);
    const [
      entities,
      vendorCount,
      glCount,
      invoiceCount,
      approvedCount,
      exportJobs,
      mailbox,
    ] = await Promise.all([
      this.prisma.entity.count({ where: { tenantId } }),
      this.prisma.vendor.count({ where: { tenantId } }),
      this.prisma.glAccount.count({ where: { tenantId } }),
      this.prisma.invoice.count({ where: { tenantId } }),
      this.prisma.invoice.count({
        where: { tenantId, status: { in: ['approved', 'exported', 'paid'] } },
      }),
      this.prisma.integrationJob.count({
        where: {
          tenantId,
          type: 'export_approved_invoices',
          status: 'succeeded',
        },
      }),
      this.prisma.captureMailbox.findUnique({ where: { tenantId } }),
    ]);
    const steps = [
      {
        id: 'entity',
        label: 'Confirm your entity',
        href: '/admin?tab=entities',
        done: entities > 0,
      },
      {
        id: 'vendors',
        label: 'Import vendors',
        href: '/integration',
        done: vendorCount > 0,
      },
      {
        id: 'gl',
        label: 'Import GL accounts',
        href: '/integration',
        done: glCount > 0,
      },
      {
        id: 'upload',
        label: 'Upload sample invoices',
        href: '/invoices',
        done: invoiceCount >= 1,
        detail: `${invoiceCount} captured`,
      },
      {
        id: 'approve',
        label: 'Approve an invoice',
        href: '/',
        done: approvedCount > 0,
        detail: `${approvedCount} approved`,
      },
      {
        id: 'export',
        label: 'Export payment-ready invoices',
        href: '/integration',
        done: exportJobs > 0,
      },
    ];
    const completed = steps.filter((s) => s.done).length;
    return {
      complete: completed === steps.length,
      completed,
      total: steps.length,
      mailboxConfigured: Boolean(mailbox?.enabled),
      steps,
    };
  }

  private toTenantRecord(tenant: {
    id: string;
    name: string;
    slug: string;
    region: 'us' | 'eu';
    createdAt: Date;
    moduleLicenses: { moduleKey: string; enabled: boolean }[];
  }): TenantRecord {
    const modules: Record<string, boolean> = {};
    for (const license of tenant.moduleLicenses) {
      modules[license.moduleKey] = license.enabled;
    }
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      region: tenant.region,
      modules,
      createdAt: tenant.createdAt.toISOString(),
    };
  }

  private entityAddressData(input: EntityWriteInput) {
    const data: Record<string, string | null | undefined> = {};
    if ('addressLine1' in input) data.addressLine1 = input.addressLine1?.trim() || null;
    if ('addressLine2' in input) data.addressLine2 = input.addressLine2?.trim() || null;
    if ('city' in input) data.city = input.city?.trim() || null;
    if ('region' in input) data.region = input.region?.trim() || null;
    if ('postalCode' in input) data.postalCode = input.postalCode?.trim() || null;
    if ('country' in input) data.country = input.country?.trim() || null;
    if (input.defaultCurrency != null) {
      data.defaultCurrency = input.defaultCurrency.trim().toUpperCase() || 'EUR';
    }
    if (input.fxProviderKey != null) {
      data.fxProviderKey = input.fxProviderKey.trim().toLowerCase() || 'ecb';
    }
    return data;
  }

  private toEntityRecord(e: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    defaultCurrency?: string;
    fxProviderKey?: string;
  }): EntityRecord {
    return {
      id: e.id,
      tenantId: e.tenantId,
      name: e.name,
      code: e.code,
      addressLine1: e.addressLine1 ?? null,
      addressLine2: e.addressLine2 ?? null,
      city: e.city ?? null,
      region: e.region ?? null,
      postalCode: e.postalCode ?? null,
      country: e.country ?? null,
      defaultCurrency: e.defaultCurrency ?? 'EUR',
      fxProviderKey: e.fxProviderKey ?? 'ecb',
    };
  }
}
