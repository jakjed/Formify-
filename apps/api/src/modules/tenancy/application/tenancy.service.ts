import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityRecord, TenantRecord } from '../domain/tenancy.types';

@Injectable()
export class TenancyService {
  private readonly tenants = new Map<string, TenantRecord>();
  private readonly entities = new Map<string, EntityRecord>();

  createTenant(input: {
    name: string;
    slug: string;
    region?: 'us' | 'eu';
  }): TenantRecord {
    const tenant: TenantRecord = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      region: input.region ?? 'us',
      modules: { invoices: true },
      createdAt: new Date().toISOString(),
    };
    this.tenants.set(tenant.id, tenant);

    const entity: EntityRecord = {
      id: randomUUID(),
      tenantId: tenant.id,
      name: `${input.name} Entity`,
      code: 'MAIN',
    };
    this.entities.set(entity.id, entity);
    return tenant;
  }

  getTenant(id: string): TenantRecord {
    const tenant = this.tenants.get(id);
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  listEntities(tenantId: string): EntityRecord[] {
    return [...this.entities.values()].filter((e) => e.tenantId === tenantId);
  }

  isModuleEnabled(tenantId: string, moduleKey: string): boolean {
    return Boolean(this.getTenant(tenantId).modules[moduleKey]);
  }
}
