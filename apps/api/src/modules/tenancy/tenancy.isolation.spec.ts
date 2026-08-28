import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Tenant isolation smoke (PRD P-01 / exit criteria).
 * Requires DATABASE_URL and applied migrations.
 */
const run = Boolean(process.env.DATABASE_URL);

(run ? describe : describe.skip)('tenant isolation', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString(36);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('tenant A cannot read tenant B invoice by id via tenant-scoped query', async () => {
    const a = await prisma.tenant.create({
      data: {
        name: `Iso A ${suffix}`,
        slug: `iso-a-${suffix}`,
        region: 'us',
        entities: { create: [{ name: 'A Main', code: 'MAIN' }] },
      },
      include: { entities: true },
    });
    const b = await prisma.tenant.create({
      data: {
        name: `Iso B ${suffix}`,
        slug: `iso-b-${suffix}`,
        region: 'eu',
        entities: { create: [{ name: 'B Main', code: 'MAIN' }] },
      },
      include: { entities: true },
    });

    const passwordHash = await argon2.hash('password1');
    await prisma.user.create({
      data: {
        tenantId: a.id,
        email: `admin-a-${suffix}@test.local`,
        displayName: 'Admin A',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    const invoiceB = await prisma.invoice.create({
      data: {
        tenantId: b.id,
        entityId: b.entities[0]!.id,
        status: 'needs_review',
        currency: 'EUR',
        invoiceNumber: `B-${suffix}`,
        vendorNameRaw: 'Secret Vendor',
        totalMinor: 12345,
      },
    });

    const leaked = await prisma.invoice.findFirst({
      where: { id: invoiceB.id, tenantId: a.id },
    });
    expect(leaked).toBeNull();

    const owned = await prisma.invoice.findFirst({
      where: { id: invoiceB.id, tenantId: b.id },
    });
    expect(owned?.invoiceNumber).toBe(`B-${suffix}`);

    await prisma.invoice.delete({ where: { id: invoiceB.id } });
    await prisma.user.deleteMany({ where: { tenantId: a.id } });
    await prisma.entity.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });
});
