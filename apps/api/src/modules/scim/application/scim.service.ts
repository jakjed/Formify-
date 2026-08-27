import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

const ROLES = ['admin', 'ap_manager', 'ap_clerk', 'approver'] as const;
type Role = (typeof ROLES)[number];

export type ScimUserResource = {
  schemas: string[];
  id: string;
  userName: string;
  displayName: string;
  active: boolean;
  emails: { value: string; primary: boolean; type: string }[];
  roles: { value: string; primary: boolean }[];
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
  };
};

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

@Injectable()
export class ScimService {
  constructor(private readonly prisma: PrismaService) {}

  toResource(user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    createdAt: Date;
  }): ScimUserResource {
    const location = `/api/scim/v2/Users/${user.id}`;
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      displayName: user.displayName,
      active: user.status !== 'locked',
      emails: [{ value: user.email, primary: true, type: 'work' }],
      roles: [{ value: user.role, primary: true }],
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.createdAt.toISOString(),
        location,
      },
    };
  }

  async list(
    tenantId: string,
    opts: { filter?: string; startIndex?: number; count?: number },
  ) {
    const startIndex = Math.max(1, opts.startIndex ?? 1);
    const count = Math.min(100, Math.max(1, opts.count ?? 100));
    const where: Prisma.UserWhereInput = { tenantId };

    if (opts.filter) {
      const match =
        opts.filter.match(/userName\s+eq\s+"([^"]+)"/i) ??
        opts.filter.match(/emails\.value\s+eq\s+"([^"]+)"/i);
      if (match?.[1]) {
        where.email = match[1].toLowerCase();
      }
    }

    const [totalResults, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: startIndex - 1,
        take: count,
      }),
    ]);

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: rows.length,
      Resources: rows.map((u) => this.toResource(u)),
    };
  }

  async get(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) this.fail(404, 'User not found');
    return this.toResource(user);
  }

  async create(
    tenantId: string,
    body: {
      userName?: string;
      displayName?: string;
      active?: boolean;
      emails?: { value?: string }[];
      roles?: { value?: string }[];
    },
  ) {
    const email = (body.userName ?? body.emails?.[0]?.value ?? '')
      .trim()
      .toLowerCase();
    if (!email) this.fail(400, 'userName or emails[0].value is required');

    const displayName = (
      body.displayName ??
      email.split('@')[0] ??
      email
    ).trim();
    const roleRaw = body.roles?.[0]?.value ?? 'ap_clerk';
    const role: Role = isRole(roleRaw) ? roleRaw : 'ap_clerk';
    const active = body.active !== false;

    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          displayName,
          role,
          status: active ? 'active' : 'locked',
          passwordHash: null,
        },
      });
      return this.toResource(user);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.fail(409, 'User already exists');
      }
      throw err;
    }
  }

  async patch(
    tenantId: string,
    id: string,
    operations: { op?: string; path?: string; value?: unknown }[],
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) this.fail(404, 'User not found');

    const data: Prisma.UserUpdateInput = {};

    for (const op of operations) {
      const kind = (op.op ?? 'replace').toLowerCase();
      if (kind !== 'replace' && kind !== 'add') continue;

      if (!op.path && op.value && typeof op.value === 'object') {
        const v = op.value as Record<string, unknown>;
        if (typeof v.displayName === 'string') data.displayName = v.displayName;
        if (typeof v.userName === 'string') data.email = v.userName.toLowerCase();
        if (typeof v.active === 'boolean') {
          data.status = v.active ? 'active' : 'locked';
          if (v.active) {
            data.lockedUntil = null;
            data.failedLoginCount = 0;
          }
        }
        continue;
      }

      const path = (op.path ?? '').replace(/\[primary eq true\]/gi, '');
      if (path === 'displayName' && typeof op.value === 'string') {
        data.displayName = op.value;
      } else if (
        (path === 'userName' || path === 'emails.value' || path === 'emails') &&
        typeof op.value === 'string'
      ) {
        data.email = op.value.toLowerCase();
      } else if (path === 'emails' && Array.isArray(op.value)) {
        const first = op.value[0] as { value?: string } | undefined;
        if (first?.value) data.email = first.value.toLowerCase();
      } else if (path === 'active' && typeof op.value === 'boolean') {
        data.status = op.value ? 'active' : 'locked';
        if (op.value) {
          data.lockedUntil = null;
          data.failedLoginCount = 0;
        }
      } else if (
        (path === 'roles' || path === 'roles.value') &&
        typeof op.value === 'string' &&
        isRole(op.value)
      ) {
        data.role = op.value;
      } else if (path === 'roles' && Array.isArray(op.value)) {
        const first = op.value[0] as { value?: string } | undefined;
        if (first?.value && isRole(first.value)) data.role = first.value;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });
    return this.toResource(updated);
  }

  async deactivate(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) this.fail(404, 'User not found');
    await this.prisma.user.update({
      where: { id },
      data: { status: 'locked' },
    });
  }

  private fail(status: number, detail: string): never {
    throw new HttpException(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: String(status),
        detail,
      },
      status,
    );
  }
}
