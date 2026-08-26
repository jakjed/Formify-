import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthProviderConfig, UserRecord } from '../domain/identity.types';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthProviders(tenantId?: string): Promise<AuthProviderConfig[]> {
    if (!tenantId) {
      return [
        { type: 'local', enabled: true, order: 1, settings: {} },
        { type: 'oidc', enabled: false, order: 2, settings: {} },
        { type: 'saml', enabled: false, order: 3, settings: {} },
      ];
    }

    const rows = await this.prisma.authProviderConfig.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });

    if (rows.length === 0) {
      return this.getAuthProviders();
    }

    return rows.map((row) => ({
      type: row.type,
      enabled: row.enabled,
      order: row.order,
      settings: (row.settings ?? {}) as Record<string, unknown>,
    }));
  }

  async register(input: {
    tenantId: string;
    email: string;
    displayName: string;
    password: string;
    role?: UserRecord['role'];
  }): Promise<Omit<UserRecord, 'passwordHash'>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = input.email.toLowerCase();
    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email,
          displayName: input.displayName,
          passwordHash: await argon2.hash(input.password),
          role: input.role ?? 'admin',
        },
      });
      return this.toSafeUser(user);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('User already exists');
      }
      throw err;
    }
  }

  async login(input: {
    tenantId: string;
    email: string;
    password: string;
  }): Promise<{ token: string; user: Omit<UserRecord, 'passwordHash'> }> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: input.tenantId, email },
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        tenantId: user.tenantId,
        expiresAt,
      },
    });

    return { token, user: this.toSafeUser(user) };
  }

  async getSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!session) return null;
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    return { userId: session.userId, tenantId: session.tenantId };
  }

  private toSafeUser(user: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    role: UserRecord['role'];
    createdAt: Date;
  }): Omit<UserRecord, 'passwordHash'> {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
