import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type EntityScope =
  | { mode: 'none'; entityIds: [] }
  | { mode: 'all'; entityIds: string[] }
  | { mode: 'one'; entityId: string; entityIds: string[] };

/**
 * Resolve which entities a user may see.
 * - Admins always see all tenant entities.
 * - Non-admins with memberships are limited to those entities.
 * - Non-admin with zero memberships sees nothing.
 *
 * `entityParam`: undefined/'all'/'' → all accessible; uuid → single if allowed.
 */
export async function resolveEntityScope(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
  role: string,
  entityParam?: string | null,
): Promise<EntityScope> {
  let accessible: string[];
  if (role === 'admin') {
    const all = await prisma.entity.findMany({
      where: { tenantId },
      select: { id: true },
    });
    accessible = all.map((e) => e.id);
  } else {
    const memberships = await prisma.userEntityMembership.findMany({
      where: { tenantId, userId },
      select: { entityId: true },
    });
    if (memberships.length > 0) {
      accessible = memberships.map((m) => m.entityId);
    } else {
      accessible = [];
    }
  }

  if (accessible.length === 0) {
    return { mode: 'none', entityIds: [] };
  }

  const raw = (entityParam ?? 'all').trim().toLowerCase();
  if (!raw || raw === 'all') {
    return { mode: 'all', entityIds: accessible };
  }

  const id = entityParam!.trim();
  if (!accessible.includes(id)) {
    throw new ForbiddenException('No access to this entity');
  }
  return {
    mode: 'one',
    entityId: id,
    entityIds: accessible,
  };
}

/**
 * Filter rows that carry an optional entityId.
 * On "All", include unassigned (null) rows so legacy data remains visible.
 */
export function scopedEntityWhere(
  scope: EntityScope,
):
  | { entityId: { in: string[] } }
  | { entityId: string }
  | { OR: Array<{ entityId: { in: string[] } } | { entityId: null }> } {
  if (scope.mode === 'none') {
    return { entityId: { in: [] } };
  }
  if (scope.mode === 'one') {
    return { entityId: scope.entityId };
  }
  return {
    OR: [{ entityId: { in: scope.entityIds } }, { entityId: null }],
  };
}

export type EntityScopeListOpts = {
  entityId?: string | null;
  userId?: string;
  role?: string;
};

/** Resolve list filter when user context and/or entityId query param are present. */
export async function buildScopedEntityWhere(
  prisma: PrismaService,
  tenantId: string,
  opts: EntityScopeListOpts,
): Promise<ReturnType<typeof scopedEntityWhere> | Record<string, never>> {
  if (!opts.userId || !opts.role) {
    if (opts.entityId && opts.entityId !== 'all') {
      return { entityId: opts.entityId };
    }
    return {};
  }
  const scope = await resolveEntityScope(
    prisma,
    tenantId,
    opts.userId,
    opts.role,
    opts.entityId,
  );
  return scopedEntityWhere(scope);
}
