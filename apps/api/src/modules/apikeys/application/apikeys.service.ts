import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { RequestUser } from '../../identity/domain/identity.types';

export const API_KEY_SCOPES = [
  'invoices:read',
  'invoices:write',
  'masterdata:write',
  'exports:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdById: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async create(input: {
    tenantId: string;
    name: string;
    scopes: string[];
    createdById?: string;
  }) {
    const scopes = input.scopes.filter((s) =>
      (API_KEY_SCOPES as readonly string[]).includes(s),
    );
    if (scopes.length === 0) {
      throw new BadRequestException('At least one valid scope is required');
    }

    const secret = randomBytes(24).toString('base64url');
    const prefix = secret.slice(0, 8);
    const raw = `aptora_${secret}`;
    const row = await this.prisma.apiKey.create({
      data: {
        tenantId: input.tenantId,
        name: input.name.trim(),
        prefix,
        keyHash: hashKey(raw),
        scopes,
        createdById: input.createdById,
      },
    });

    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      createdAt: row.createdAt,
      /** Shown once — store securely */
      token: raw,
    };
  }

  async revoke(tenantId: string, id: string) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('API key not found');
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async resolveBearer(raw: string): Promise<RequestUser | null> {
    const keyHash = hashKey(raw);
    const row = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!row || row.revokedAt) return null;

    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: row.createdById ?? row.id,
      tenantId: row.tenantId,
      email: `apikey:${row.prefix}@aptora.local`,
      displayName: `API key (${row.name})`,
      role: 'admin',
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: row.createdAt.toISOString(),
      authKind: 'api_key',
      scopes: row.scopes,
      apiKeyId: row.id,
    };
  }
}
