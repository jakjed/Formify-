import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthProviderConfig, UserRecord } from '../domain/identity.types';

function hashPassword(password: string): string {
  // E0 placeholder — replace with bcrypt/argon2 before production
  return createHash('sha256').update(`aptora:${password}`).digest('hex');
}

@Injectable()
export class IdentityService {
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, { userId: string; tenantId: string }>();

  getAuthProviders(): AuthProviderConfig[] {
    return [
      { type: 'local', enabled: true, order: 1, settings: {} },
      { type: 'oidc', enabled: false, order: 2, settings: {} },
      { type: 'saml', enabled: false, order: 3, settings: {} },
    ];
  }

  register(input: {
    tenantId: string;
    email: string;
    displayName: string;
    password: string;
    role?: UserRecord['role'];
  }): Omit<UserRecord, 'passwordHash'> {
    const email = input.email.toLowerCase();
    if ([...this.users.values()].some((u) => u.email === email && u.tenantId === input.tenantId)) {
      throw new ConflictException('User already exists');
    }
    const user: UserRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      email,
      displayName: input.displayName,
      passwordHash: hashPassword(input.password),
      role: input.role ?? 'admin',
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  login(input: {
    tenantId: string;
    email: string;
    password: string;
  }): { token: string; user: Omit<UserRecord, 'passwordHash'> } {
    const email = input.email.toLowerCase();
    const user = [...this.users.values()].find(
      (u) => u.tenantId === input.tenantId && u.email === email,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const incoming = Buffer.from(hashPassword(input.password));
    const stored = Buffer.from(user.passwordHash);
    if (incoming.length !== stored.length || !timingSafeEqual(incoming, stored)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = randomUUID();
    this.sessions.set(token, { userId: user.id, tenantId: user.tenantId });
    const { passwordHash: _, ...safe } = user;
    return { token, user: safe };
  }

  getSession(token: string) {
    return this.sessions.get(token) ?? null;
  }
}
