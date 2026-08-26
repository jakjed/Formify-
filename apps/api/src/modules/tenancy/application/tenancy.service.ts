import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
