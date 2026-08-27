import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthProviderConfig, UserRecord } from '../domain/identity.types';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
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
      settings: this.publicSettings(
        row.type,
        (row.settings ?? {}) as Record<string, unknown>,
      ),
    }));
  }

  async listProvidersAdmin(tenantId: string) {
    const rows = await this.prisma.authProviderConfig.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => {
      const settings = (row.settings ?? {}) as Record<string, unknown>;
      const { clientSecret, ...rest } = settings;
      return {
        type: row.type,
        enabled: row.enabled,
        order: row.order,
        settings: rest,
        clientSecretSet: Boolean(clientSecret),
      };
    });
  }

  async updateOidcProvider(
    tenantId: string,
    input: {
      enabled?: boolean;
      settings?: {
        issuer?: string;
        clientId?: string;
        clientSecret?: string | null;
        scopes?: string;
        displayName?: string;
        mode?: 'live' | 'mock';
        mockEmail?: string;
      };
    },
  ) {
    const existing = await this.prisma.authProviderConfig.findUnique({
      where: { tenantId_type: { tenantId, type: 'oidc' } },
    });
    const prev = (existing?.settings ?? {}) as Record<string, unknown>;
    const nextSettings = { ...prev };
    if (input.settings) {
      for (const [key, value] of Object.entries(input.settings)) {
        if (key === 'clientSecret') {
          if (value === null) {
            delete nextSettings.clientSecret;
          } else if (typeof value === 'string' && value.trim()) {
            nextSettings.clientSecret = value.trim();
          }
          continue;
        }
        if (value !== undefined) {
          nextSettings[key] = value;
        }
      }
    }
    const row = await this.prisma.authProviderConfig.upsert({
      where: { tenantId_type: { tenantId, type: 'oidc' } },
      create: {
        tenantId,
        type: 'oidc',
        enabled: input.enabled ?? false,
        order: 2,
        settings: nextSettings as Prisma.InputJsonValue,
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        settings: nextSettings as Prisma.InputJsonValue,
      },
    });
    const { clientSecret, ...safe } = (row.settings ?? {}) as Record<
      string,
      unknown
    >;
    return {
      type: row.type,
      enabled: row.enabled,
      order: row.order,
      settings: safe,
      clientSecretSet: Boolean(clientSecret),
    };
  }

  /**
   * Create a session for an existing active user matched by email (SSO).
   */
  async createSessionForEmail(input: {
    tenantId: string;
    email: string;
    displayName?: string;
  }) {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: input.tenantId, email } },
    });
    if (!user) {
      throw new UnauthorizedException(
        'No Aptora user for this email — invite or create the user first',
      );
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }
    if (user.status === 'invited') {
      throw new UnauthorizedException(
        'Account pending invite acceptance before SSO login',
      );
    }
    if (user.status === 'locked') {
      throw new ForbiddenException('Account is locked');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: 'active',
        ...(input.displayName && !user.displayName
          ? { displayName: input.displayName }
          : {}),
      },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: updated.id,
        tenantId: updated.tenantId,
        expiresAt,
      },
    });
    return { token, user: this.toSafeUser(updated) };
  }

  private publicSettings(
    type: string,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    if (type !== 'oidc') return {};
    return {
      displayName:
        typeof settings.displayName === 'string'
          ? settings.displayName
          : 'SSO',
      mode: settings.mode === 'mock' ? 'mock' : 'live',
    };
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
          status: 'active',
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

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    if (user.status === 'invited' || !user.passwordHash) {
      throw new UnauthorizedException(
        'Account pending invite acceptance — set a password via invite link',
      );
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil =
        failedLoginCount >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCKOUT_MS)
          : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil,
          ...(lockedUntil ? { status: 'locked' } : {}),
        },
      });
      if (lockedUntil) {
        throw new ForbiddenException(
          `Account locked until ${lockedUntil.toISOString()} after ${MAX_FAILED_LOGINS} failed attempts`,
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: 'active',
      },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: updated.id,
        tenantId: updated.tenantId,
        expiresAt,
      },
    });

    return { token, user: this.toSafeUser(updated) };
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

  async getUserById(id: string): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toSafeUser(user) : null;
  }

  listUsers(tenantId: string) {
    return this.prisma.user
      .findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      })
      .then((rows) => rows.map((u) => this.toSafeUser(u)));
  }

  async createUser(input: {
    tenantId: string;
    email: string;
    displayName: string;
    password: string;
    role: UserRecord['role'];
  }) {
    return this.register(input);
  }

  async inviteUser(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role: UserRecord['role'];
    invitedById?: string;
  }) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: input.tenantId, email } },
    });
    if (existing && existing.status !== 'invited') {
      throw new ConflictException('User already exists');
    }

    const user =
      existing ??
      (await this.prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email,
          displayName: input.displayName,
          role: input.role,
          status: 'invited',
          passwordHash: null,
        },
      }));

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName,
          role: input.role,
          status: 'invited',
          passwordHash: null,
        },
      });
    }

    await this.prisma.userInvite.updateMany({
      where: { userId: user.id, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });

    const token = newOpaqueToken();
    const invite = await this.prisma.userInvite.create({
      data: {
        tenantId: input.tenantId,
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        invitedById: input.invitedById,
      },
    });

    const safe = await this.getUserById(user.id);
    return {
      user: safe!,
      inviteToken: token,
      acceptPath: `/invite/${token}`,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async getInvite(token: string) {
    const invite = await this.prisma.userInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, tenant: true },
    });
    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invite expired');
    }
    return {
      email: invite.user.email,
      displayName: invite.user.displayName,
      role: invite.user.role,
      tenantId: invite.tenantId,
      tenantName: invite.tenant.name,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async acceptInvite(input: { token: string; password: string }) {
    const invite = await this.prisma.userInvite.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { user: true },
    });
    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invite expired');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.update({
      where: { id: invite.userId },
      data: {
        passwordHash,
        status: 'active',
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return this.login({
      tenantId: user.tenantId,
      email: user.email,
      password: input.password,
    });
  }

  async requestPasswordReset(input: { tenantId: string; email: string }) {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: input.tenantId, email },
      },
    });

    // Always succeed to avoid account enumeration.
    if (!user || user.status === 'invited' || !user.passwordHash) {
      return { ok: true as const };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = newOpaqueToken();
    const row = await this.prisma.passwordResetToken.create({
      data: {
        tenantId: input.tenantId,
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    return {
      ok: true as const,
      // Returned for local/dev UX until email delivery is wired.
      resetToken: token,
      resetPath: `/reset/${token}`,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async getPasswordReset(token: string) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, tenant: true },
    });
    if (!row || row.usedAt) {
      throw new NotFoundException('Reset token not found');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset token expired');
    }
    return {
      email: row.user.email,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async confirmPasswordReset(input: { token: string; password: string }) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!row || row.usedAt) {
      throw new NotFoundException('Reset token not found');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset token expired');
    }

    await this.prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash: await argon2.hash(input.password),
        status: 'active',
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await this.prisma.session.deleteMany({ where: { userId: row.userId } });

    return { ok: true as const };
  }

  async updateUser(
    tenantId: string,
    id: string,
    patch: {
      displayName?: string;
      role?: UserRecord['role'];
      password?: string;
    },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        displayName: patch.displayName,
        role: patch.role,
        ...(patch.password
          ? {
              passwordHash: await argon2.hash(patch.password),
              status: 'active' as const,
              failedLoginCount: 0,
              lockedUntil: null,
            }
          : {}),
      },
    });
    return this.toSafeUser(user);
  }

  private toSafeUser(user: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    role: UserRecord['role'];
    status: UserRecord['status'];
    failedLoginCount: number;
    lockedUntil: Date | null;
    createdAt: Date;
  }): Omit<UserRecord, 'passwordHash'> {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
