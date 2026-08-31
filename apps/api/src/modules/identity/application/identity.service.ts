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
import * as jose from 'jose';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  mfaSigningKey,
  otpauthUrl,
  verifyTotp,
} from '../../../common/totp';
import type {
  ApprovalDelegationRecord,
  AuthProviderConfig,
  EntityMembershipSummary,
  UserRecord,
} from '../domain/identity.types';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const userMembershipInclude = {
  entityMemberships: {
    include: {
      entity: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveWorkspace(input: { tenantId?: string; slug?: string }) {
    const tenant = await this.findTenant(input);
    if (!tenant) {
      throw new NotFoundException('Workspace not found');
    }
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    };
  }

  async findTenant(input: {
    tenantId?: string;
    slug?: string;
  }): Promise<{ id: string; slug: string; name: string } | null> {
    const rawId = input.tenantId?.trim();
    const rawSlug = input.slug?.trim();
    const uuid =
      (rawId && isUuid(rawId) ? rawId : undefined) ??
      (rawSlug && isUuid(rawSlug) ? rawSlug : undefined);
    if (uuid) {
      const byId = await this.prisma.tenant.findUnique({
        where: { id: uuid },
        select: { id: true, slug: true, name: true },
      });
      if (byId) return byId;
    }
    const slug = (rawSlug || (!uuid ? rawId : undefined))?.toLowerCase();
    if (!slug || isUuid(slug)) return null;
    return this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
  }

  async getAuthProviders(tenantId?: string, slug?: string): Promise<AuthProviderConfig[]> {
    let resolvedId = tenantId;
    if (!resolvedId && slug) {
      const tenant = await this.findTenant({ slug });
      resolvedId = tenant?.id;
    } else if (resolvedId && !isUuid(resolvedId)) {
      const tenant = await this.findTenant({ slug: resolvedId });
      resolvedId = tenant?.id;
    }

    if (!resolvedId) {
      return [
        { type: 'local', enabled: true, order: 1, settings: {} },
        { type: 'oidc', enabled: false, order: 2, settings: {} },
        { type: 'saml', enabled: false, order: 3, settings: {} },
      ];
    }

    const rows = await this.prisma.authProviderConfig.findMany({
      where: { tenantId: resolvedId },
      orderBy: { order: 'asc' },
    });

    const hideMock = process.env.NODE_ENV === 'production';

    if (rows.length === 0) {
      return this.getAuthProviders();
    }

    return rows
      .map((row) => {
        const settings = this.publicSettings(
          row.type,
          (row.settings ?? {}) as Record<string, unknown>,
        );
        const mock = settings.mode === 'mock';
        const enabled = row.enabled && !(hideMock && mock);
        return {
          type: row.type,
          enabled,
          order: row.order,
          settings: hideMock && mock ? { ...settings, mode: 'live' } : settings,
        };
      })
      .filter((row) => row.type === 'local' || row.enabled || !hideMock);
  }

  async listProvidersAdmin(tenantId: string) {
    const rows = await this.prisma.authProviderConfig.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => {
      const settings = (row.settings ?? {}) as Record<string, unknown>;
      const { clientSecret, idpCertificate, ...rest } = settings;
      return {
        type: row.type,
        enabled: row.enabled,
        order: row.order,
        settings: rest,
        clientSecretSet: Boolean(clientSecret),
        idpCertificateSet: Boolean(idpCertificate),
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
        'No Procure Ledger user for this email — invite or create the user first',
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
      include: userMembershipInclude,
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
    if (type === 'oidc') {
      return {
        displayName:
          typeof settings.displayName === 'string'
            ? settings.displayName
            : 'SSO',
        mode: settings.mode === 'mock' ? 'mock' : 'live',
      };
    }
    if (type === 'saml') {
      return {
        displayName:
          typeof settings.displayName === 'string'
            ? settings.displayName
            : 'SAML SSO',
        mode: settings.mode === 'mock' ? 'mock' : 'live',
      };
    }
    return {};
  }

  async listDelegationCandidates(tenantId: string, userId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'active',
        NOT: { id: userId },
      },
      select: { id: true, email: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async updateSamlProvider(
    tenantId: string,
    input: {
      enabled?: boolean;
      settings?: {
        idpEntityId?: string;
        idpSsoUrl?: string;
        idpCertificate?: string | null;
        spEntityId?: string;
        displayName?: string;
        mode?: 'live' | 'mock';
        mockEmail?: string;
      };
    },
  ) {
    const existing = await this.prisma.authProviderConfig.findUnique({
      where: { tenantId_type: { tenantId, type: 'saml' } },
    });
    const prev = (existing?.settings ?? {}) as Record<string, unknown>;
    const nextSettings = { ...prev };
    if (input.settings) {
      for (const [key, value] of Object.entries(input.settings)) {
        if (key === 'idpCertificate') {
          if (value === null) {
            delete nextSettings.idpCertificate;
          } else if (typeof value === 'string' && value.trim()) {
            nextSettings.idpCertificate = value.trim();
          }
          continue;
        }
        if (value !== undefined) {
          nextSettings[key] = value;
        }
      }
    }
    const row = await this.prisma.authProviderConfig.upsert({
      where: { tenantId_type: { tenantId, type: 'saml' } },
      create: {
        tenantId,
        type: 'saml',
        enabled: input.enabled ?? false,
        order: 3,
        settings: nextSettings as Prisma.InputJsonValue,
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        settings: nextSettings as Prisma.InputJsonValue,
      },
    });
    const { idpCertificate, ...safe } = (row.settings ?? {}) as Record<
      string,
      unknown
    >;
    return {
      type: row.type,
      enabled: row.enabled,
      order: row.order,
      settings: safe,
      idpCertificateSet: Boolean(idpCertificate),
    };
  }

  async register(input: {
    tenantId: string;
    email: string;
    displayName: string;
    password: string;
    role?: UserRecord['role'];
    canAccessDirectory?: boolean;
    canApprove?: boolean;
  }): Promise<Omit<UserRecord, 'passwordHash'>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = input.email.toLowerCase();
    const role = input.role ?? 'admin';
    const canAccessDirectory =
      input.canAccessDirectory ?? (role === 'admin' ? true : false);
    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email,
          displayName: input.displayName,
          passwordHash: await argon2.hash(input.password),
          role,
          status: 'active',
          canAccessDirectory,
          canApprove: input.canApprove ?? false,
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
    tenantId?: string;
    slug?: string;
    email: string;
    password: string;
    totpCode?: string;
  }): Promise<
    | { token: string; user: Omit<UserRecord, 'passwordHash'>; mfaRequired?: false }
    | { mfaRequired: true; mfaToken: string }
  > {
    const tenant = await this.findTenant({
      tenantId: input.tenantId,
      slug: input.slug,
    });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email },
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

    if (user.totpEnabled && user.totpSecret) {
      if (input.totpCode) {
        const secret = decryptTotpSecret(user.totpSecret);
        if (!verifyTotp(secret, input.totpCode)) {
          throw new UnauthorizedException('Invalid authenticator code');
        }
      } else {
        const mfaToken = await this.signMfaChallenge(user.id, tenant.id);
        return { mfaRequired: true, mfaToken };
      }
    }

    return this.issueSession(user.id);
  }

  async verifyMfa(input: { mfaToken: string; code: string }) {
    const payload = await this.verifyMfaChallenge(input.mfaToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('MFA is not enabled');
    }
    const secret = decryptTotpSecret(user.totpSecret);
    if (!verifyTotp(secret, input.code)) {
      throw new UnauthorizedException('Invalid authenticator code');
    }
    return this.issueSession(user.id);
  }

  async startMfaSetup(userId: string, email: string) {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encrypted, totpEnabled: false },
    });
    return {
      secret,
      otpauthUrl: otpauthUrl(secret, email),
    };
  }

  async confirmMfaSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) {
      throw new BadRequestException('Start MFA setup first');
    }
    const secret = decryptTotpSecret(user.totpSecret);
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException('Invalid authenticator code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    return { totpEnabled: true };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled || !user.totpSecret) {
      return { totpEnabled: false };
    }
    const secret = decryptTotpSecret(user.totpSecret);
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException('Invalid authenticator code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { totpEnabled: false };
  }

  private async issueSession(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: 'active',
      },
      include: userMembershipInclude,
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

    return { token, user: this.toSafeUser(updated), mfaRequired: false as const };
  }

  private async signMfaChallenge(userId: string, tenantId: string) {
    return new jose.SignJWT({ userId, tenantId, purpose: 'mfa' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .sign(mfaSigningKey());
  }

  private async verifyMfaChallenge(token: string) {
    try {
      const { payload } = await jose.jwtVerify(token, mfaSigningKey());
      if (payload.purpose !== 'mfa' || typeof payload.userId !== 'string') {
        throw new UnauthorizedException('Invalid MFA challenge');
      }
      return { userId: payload.userId, tenantId: String(payload.tenantId ?? '') };
    } catch {
      throw new UnauthorizedException('MFA challenge expired — sign in again');
    }
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userMembershipInclude,
    });
    return user ? this.toSafeUser(user) : null;
  }

  listUsers(tenantId: string, q?: string) {
    const query = q?.trim();
    return this.prisma.user
      .findMany({
        where: {
          tenantId,
          ...(query
            ? {
                OR: [
                  { email: { contains: query, mode: 'insensitive' } },
                  { displayName: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: userMembershipInclude,
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
    entityIds?: string[];
    defaultEntityId?: string;
    canAccessDirectory?: boolean;
    canApprove?: boolean;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = input.email.toLowerCase();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: input.tenantId,
            email,
            displayName: input.displayName,
            passwordHash: await argon2.hash(input.password),
            role: input.role,
            status: 'active',
            canAccessDirectory: input.canAccessDirectory ?? false,
            canApprove: input.canApprove ?? false,
          },
        });
        if (input.entityIds) {
          await this.replaceEntityMemberships(
            tx,
            input.tenantId,
            created.id,
            input.entityIds,
            input.defaultEntityId,
          );
        }
        return tx.user.findUniqueOrThrow({
          where: { id: created.id },
          include: userMembershipInclude,
        });
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

  async inviteUser(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role: UserRecord['role'];
    invitedById?: string;
    entityIds?: string[];
    defaultEntityId?: string;
    canAccessDirectory?: boolean;
    canApprove?: boolean;
  }) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: input.tenantId, email } },
    });
    if (existing && existing.status !== 'invited') {
      throw new ConflictException('User already exists');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      let row =
        existing ??
        (await tx.user.create({
          data: {
            tenantId: input.tenantId,
            email,
            displayName: input.displayName,
            role: input.role,
            status: 'invited',
            passwordHash: null,
            canAccessDirectory: input.canAccessDirectory ?? false,
            canApprove: input.canApprove ?? false,
          },
        }));

      if (existing) {
        row = await tx.user.update({
          where: { id: existing.id },
          data: {
            displayName: input.displayName,
            role: input.role,
            status: 'invited',
            passwordHash: null,
            ...(input.canAccessDirectory !== undefined
              ? { canAccessDirectory: input.canAccessDirectory }
              : {}),
            ...(input.canApprove !== undefined
              ? { canApprove: input.canApprove }
              : {}),
          },
        });
      }

      if (input.entityIds) {
        await this.replaceEntityMemberships(
          tx,
          input.tenantId,
          row.id,
          input.entityIds,
          input.defaultEntityId,
        );
      }
      return row;
    });

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

    return this.issueSession(user.id);
  }

  async requestPasswordReset(input: {
    tenantId?: string;
    slug?: string;
    email: string;
  }) {
    const tenant = await this.findTenant({
      tenantId: input.tenantId,
      slug: input.slug,
    });
    const email = input.email.toLowerCase();
    if (!tenant) {
      return { ok: true as const };
    }
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email },
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
        tenantId: tenant.id,
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
      status?: UserRecord['status'];
      password?: string;
      entityIds?: string[];
      defaultEntityId?: string;
      canAccessDirectory?: boolean;
      canApprove?: boolean;
    },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('User not found');

    const passwordHash = patch.password
      ? await argon2.hash(patch.password)
      : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          displayName: patch.displayName,
          role: patch.role,
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.canAccessDirectory !== undefined
            ? { canAccessDirectory: patch.canAccessDirectory }
            : {}),
          ...(patch.canApprove !== undefined
            ? { canApprove: patch.canApprove }
            : {}),
          ...(passwordHash
            ? {
                passwordHash,
                status: (patch.status ?? 'active') as UserRecord['status'],
                failedLoginCount: 0,
                lockedUntil: null,
              }
            : {}),
        },
      });

      if (patch.entityIds !== undefined) {
        await this.replaceEntityMemberships(
          tx,
          tenantId,
          id,
          patch.entityIds,
          patch.defaultEntityId,
        );
      } else if (patch.defaultEntityId !== undefined) {
        await this.setDefaultEntity(tx, tenantId, id, patch.defaultEntityId);
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: userMembershipInclude,
      });
    });
    return this.toSafeUser(user);
  }

  async listDelegations(
    tenantId: string,
    userId: string,
    options?: { all?: boolean; isAdmin?: boolean },
  ) {
    const includeUsers = {
      fromUser: { select: { id: true, email: true, displayName: true } },
      toUser: { select: { id: true, email: true, displayName: true } },
    } as const;

    if (options?.all && options.isAdmin) {
      const rows = await this.prisma.approvalDelegation.findMany({
        where: { tenantId },
        include: includeUsers,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => this.toDelegationRecord(row));
    }

    const [outgoing, incoming] = await Promise.all([
      this.prisma.approvalDelegation.findMany({
        where: { tenantId, fromUserId: userId, active: true },
        include: includeUsers,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.approvalDelegation.findMany({
        where: { tenantId, toUserId: userId, active: true },
        include: includeUsers,
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    return {
      outgoing: outgoing.map((row) => this.toDelegationRecord(row)),
      incoming: incoming.map((row) => this.toDelegationRecord(row)),
    };
  }

  async createDelegation(
    tenantId: string,
    fromUserId: string,
    input: {
      toUserId: string;
      startsAt: string;
      endsAt: string;
      reason?: string;
    },
  ): Promise<ApprovalDelegationRecord> {
    if (fromUserId === input.toUserId) {
      throw new BadRequestException('Cannot delegate approval rights to yourself');
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid delegation date range');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const [fromUser, toUser] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: fromUserId, tenantId, status: 'active' },
      }),
      this.prisma.user.findFirst({
        where: { id: input.toUserId, tenantId, status: 'active' },
      }),
    ]);
    if (!fromUser) throw new NotFoundException('Delegator user not found');
    if (!toUser) throw new NotFoundException('Delegate user not found');

    const row = await this.prisma.approvalDelegation.create({
      data: {
        tenantId,
        fromUserId,
        toUserId: input.toUserId,
        startsAt,
        endsAt,
        reason: input.reason?.trim() || null,
      },
      include: {
        fromUser: { select: { id: true, email: true, displayName: true } },
        toUser: { select: { id: true, email: true, displayName: true } },
      },
    });
    return this.toDelegationRecord(row);
  }

  async updateDelegation(
    tenantId: string,
    id: string,
    actorUserId: string,
    patch: { active?: boolean },
    isAdmin: boolean,
  ): Promise<ApprovalDelegationRecord> {
    const existing = await this.prisma.approvalDelegation.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Delegation not found');
    if (!isAdmin && existing.fromUserId !== actorUserId) {
      throw new ForbiddenException('Only the delegator or an admin can update this delegation');
    }
    if (patch.active === undefined) {
      throw new BadRequestException('No changes provided');
    }

    const row = await this.prisma.approvalDelegation.update({
      where: { id },
      data: { active: patch.active },
      include: {
        fromUser: { select: { id: true, email: true, displayName: true } },
        toUser: { select: { id: true, email: true, displayName: true } },
      },
    });
    return this.toDelegationRecord(row);
  }

  async revokeDelegation(
    tenantId: string,
    id: string,
    actorUserId: string,
    isAdmin: boolean,
  ) {
    const existing = await this.prisma.approvalDelegation.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Delegation not found');
    if (!isAdmin && existing.fromUserId !== actorUserId) {
      throw new ForbiddenException('Only the delegator or an admin can revoke this delegation');
    }
    await this.prisma.approvalDelegation.update({
      where: { id },
      data: { active: false },
    });
    return { ok: true as const };
  }

  private async replaceEntityMemberships(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    entityIds: string[],
    defaultEntityId?: string,
  ) {
    const uniqueIds = [...new Set(entityIds)];
    if (uniqueIds.length > 0) {
      const entities = await tx.entity.findMany({
        where: { tenantId, id: { in: uniqueIds } },
        select: { id: true },
      });
      if (entities.length !== uniqueIds.length) {
        throw new BadRequestException(
          'One or more entities do not belong to this tenant',
        );
      }
    }

    if (
      defaultEntityId &&
      uniqueIds.length > 0 &&
      !uniqueIds.includes(defaultEntityId)
    ) {
      throw new BadRequestException(
        'defaultEntityId must be included in entityIds',
      );
    }

    await tx.userEntityMembership.deleteMany({ where: { userId, tenantId } });
    if (uniqueIds.length === 0) return;

    const defaultId =
      defaultEntityId && uniqueIds.includes(defaultEntityId)
        ? defaultEntityId
        : uniqueIds[0];

    await tx.userEntityMembership.createMany({
      data: uniqueIds.map((entityId) => ({
        tenantId,
        userId,
        entityId,
        isDefault: entityId === defaultId,
      })),
    });
  }

  private async setDefaultEntity(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    defaultEntityId: string,
  ) {
    const membership = await tx.userEntityMembership.findFirst({
      where: { tenantId, userId, entityId: defaultEntityId },
    });
    if (!membership) {
      throw new BadRequestException(
        'defaultEntityId is not in the user entity memberships',
      );
    }
    await tx.userEntityMembership.updateMany({
      where: { tenantId, userId },
      data: { isDefault: false },
    });
    await tx.userEntityMembership.update({
      where: { id: membership.id },
      data: { isDefault: true },
    });
  }

  private toSafeUser(user: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    role: UserRecord['role'];
    status: UserRecord['status'];
    canAccessDirectory: boolean;
    canApprove: boolean;
    failedLoginCount: number;
    lockedUntil: Date | null;
    totpEnabled?: boolean;
    createdAt: Date;
    entityMemberships?: {
      id: string;
      entityId: string;
      isDefault: boolean;
      entity: { id: string; code: string; name: string };
    }[];
  }): Omit<UserRecord, 'passwordHash'> {
    const memberships: EntityMembershipSummary[] | undefined =
      user.entityMemberships?.map((m) => ({
        id: m.id,
        entityId: m.entityId,
        isDefault: m.isDefault,
        entity: m.entity,
      }));
    const defaultEntityId =
      memberships?.find((m) => m.isDefault)?.entityId ??
      memberships?.[0]?.entityId ??
      null;
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      canAccessDirectory: user.canAccessDirectory,
      canApprove: user.canApprove,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
      totpEnabled: Boolean(user.totpEnabled),
      createdAt: user.createdAt.toISOString(),
      defaultEntityId,
      ...(memberships ? { entityMemberships: memberships } : {}),
    };
  }

  private toDelegationRecord(row: {
    id: string;
    tenantId: string;
    fromUserId: string;
    toUserId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
    active: boolean;
    createdAt: Date;
    fromUser?: { id: string; email: string; displayName: string };
    toUser?: { id: string; email: string; displayName: string };
  }): ApprovalDelegationRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      reason: row.reason,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      ...(row.fromUser ? { fromUser: row.fromUser } : {}),
      ...(row.toUser ? { toUser: row.toUser } : {}),
    };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
