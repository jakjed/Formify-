import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { API_KEY_SCOPES } from '../../apikeys/application/apikeys.service';
import type { RequestUser } from '../../identity/domain/identity.types';

/** Reuse the same scope vocabulary as API keys. */
export const OAUTH_SCOPES = API_KEY_SCOPES;

const ACCESS_TOKEN_TTL_SECONDS = 3600;

function hashSecret(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class OAuthService {
  constructor(private readonly prisma: PrismaService) {}

  listClients(tenantId: string) {
    return this.prisma.oAuthClient.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        clientId: true,
        scopes: true,
        createdById: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async createClient(input: {
    tenantId: string;
    name: string;
    scopes: string[];
    createdById?: string;
  }) {
    const scopes = input.scopes.filter((s) =>
      (OAUTH_SCOPES as readonly string[]).includes(s),
    );
    if (scopes.length === 0) {
      throw new BadRequestException('At least one valid scope is required');
    }

    const clientId = `aptcli_${randomBytes(16).toString('base64url')}`;
    const clientSecret = `aptsec_${randomBytes(24).toString('base64url')}`;

    const row = await this.prisma.oAuthClient.create({
      data: {
        tenantId: input.tenantId,
        name: input.name.trim(),
        clientId,
        clientSecretHash: hashSecret(clientSecret),
        scopes,
        createdById: input.createdById,
      },
    });

    return {
      id: row.id,
      name: row.name,
      clientId: row.clientId,
      scopes: row.scopes,
      createdAt: row.createdAt,
      /** Shown once — store securely */
      clientSecret,
    };
  }

  async revokeClient(tenantId: string, id: string) {
    const row = await this.prisma.oAuthClient.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('OAuth client not found');

    const revoked = await this.prisma.oAuthClient.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        clientId: true,
        scopes: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    // Invalidate outstanding access tokens for this client
    await this.prisma.oAuthAccessToken.deleteMany({
      where: { clientId: id },
    });

    return revoked;
  }

  async issueClientCredentialsToken(input: {
    clientId: string;
    clientSecret: string;
  }) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: input.clientId },
    });
    if (
      !client ||
      client.revokedAt ||
      client.clientSecretHash !== hashSecret(input.clientSecret)
    ) {
      throw new UnauthorizedException('invalid_client');
    }

    const raw = `aptoauth_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

    await this.prisma.oAuthAccessToken.create({
      data: {
        tenantId: client.tenantId,
        clientId: client.id,
        tokenHash: hashSecret(raw),
        scopes: client.scopes,
        expiresAt,
      },
    });

    await this.prisma.oAuthClient.update({
      where: { id: client.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      access_token: raw,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: client.scopes.join(' '),
    };
  }

  async resolveBearer(raw: string): Promise<RequestUser | null> {
    if (!raw.startsWith('aptoauth_')) return null;

    const row = await this.prisma.oAuthAccessToken.findUnique({
      where: { tokenHash: hashSecret(raw) },
      include: { client: true },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    if (row.client.revokedAt) return null;

    return {
      id: row.client.createdById ?? row.clientId,
      tenantId: row.tenantId,
      email: `oauth:${row.client.clientId}@aptora.local`,
      displayName: `OAuth app (${row.client.name})`,
      role: 'admin',
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: row.client.createdAt.toISOString(),
      authKind: 'oauth_client',
      scopes: row.scopes,
      oauthClientId: row.clientId,
    };
  }
}
