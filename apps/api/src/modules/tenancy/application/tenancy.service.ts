import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { EntityRecord, TenantRecord } from '../domain/tenancy.types';

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
      const tenant = await this.prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          region: input.region ?? 'us',
          moduleLicenses: {
            create: [{ moduleKey: 'invoices', enabled: true }],
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
            create: {
              name: 'Default invoice policy',
              enabled: true,
              autoApproveUnderMinor: 10000, // €100.00
            },
          },
          captureMailbox: {
            create: {
              address: `${input.slug}-invoices@inbound.aptora.local`,
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
        throw new ConflictException(`Tenant slug "${input.slug}" already exists`);
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
    return entities.map((e) => ({
      id: e.id,
      tenantId: e.tenantId,
      name: e.name,
      code: e.code,
    }));
  }

  async createEntity(
    tenantId: string,
    input: { name: string; code: string },
  ): Promise<EntityRecord> {
    await this.getTenant(tenantId);
    try {
      const entity = await this.prisma.entity.create({
        data: {
          tenantId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
        },
      });
      return {
        id: entity.id,
        tenantId: entity.tenantId,
        name: entity.name,
        code: entity.code,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Entity code "${input.code}" already exists`);
      }
      throw err;
    }
  }

  async updateEntity(
    tenantId: string,
    id: string,
    input: { name?: string; code?: string },
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
        },
      });
      return {
        id: entity.id,
        tenantId: entity.tenantId,
        name: entity.name,
        code: entity.code,
      };
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
}
