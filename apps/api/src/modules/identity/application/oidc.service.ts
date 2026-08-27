import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as jose from 'jose';
import { PrismaService } from '../../../database/prisma.service';
import { IdentityService } from './identity.service';

export type OidcSettings = {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string;
  displayName?: string;
  mode?: 'live' | 'mock';
  mockEmail?: string;
};

type DiscoveryDoc = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

@Injectable()
export class OidcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
  ) {}

  private webOrigin() {
    const raw = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173';
    return raw.split(',')[0]!.trim().replace(/\/$/, '');
  }

  private apiPublicBase() {
    return (
      process.env.API_PUBLIC_URL?.replace(/\/$/, '') ??
      `http://127.0.0.1:${process.env.PORT ?? 3001}`
    );
  }

  callbackUrl() {
    return `${this.apiPublicBase()}/api/auth/oidc/callback`;
  }

  async getOidcConfig(tenantId: string) {
    const row = await this.prisma.authProviderConfig.findUnique({
      where: { tenantId_type: { tenantId, type: 'oidc' } },
    });
    if (!row) throw new NotFoundException('OIDC provider not configured');
    return row;
  }

  async start(tenantId: string, opts?: { email?: string; redirectTo?: string }) {
    const row = await this.getOidcConfig(tenantId);
    if (!row.enabled) {
      throw new BadRequestException('OIDC is not enabled for this tenant');
    }
    const settings = (row.settings ?? {}) as OidcSettings;
    const mode = settings.mode ?? 'live';
    const state = randomBytes(24).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    await this.prisma.oidcAuthState.create({
      data: {
        tenantId,
        state,
        codeVerifier,
        nonce,
        redirectTo: opts?.redirectTo ?? null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    if (mode === 'mock') {
      const email =
        opts?.email?.toLowerCase() ||
        settings.mockEmail?.toLowerCase() ||
        '';
      const params = new URLSearchParams({
        code: `mock:${email || 'use-settings'}`,
        state,
      });
      return {
        redirectUrl: `${this.apiPublicBase()}/api/auth/oidc/callback?${params}`,
      };
    }

    if (!settings.issuer || !settings.clientId) {
      throw new BadRequestException(
        'OIDC issuer and clientId are required for live mode',
      );
    }
    const discovery = await this.discover(settings.issuer);
    const scopes = settings.scopes ?? 'openid email profile';
    const authUrl = new URL(discovery.authorization_endpoint);
    authUrl.searchParams.set('client_id', settings.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', this.callbackUrl());
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    return { redirectUrl: authUrl.toString() };
  }

  async callback(input: { code?: string; state?: string; error?: string }) {
    if (input.error) {
      throw new BadRequestException(`OIDC error: ${input.error}`);
    }
    if (!input.code || !input.state) {
      throw new BadRequestException('Missing code or state');
    }

    const pending = await this.prisma.oidcAuthState.findUnique({
      where: { state: input.state },
    });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OIDC state expired or unknown');
    }
    await this.prisma.oidcAuthState.delete({ where: { id: pending.id } });

    const row = await this.getOidcConfig(pending.tenantId);
    if (!row.enabled) {
      throw new BadRequestException('OIDC is not enabled');
    }
    const settings = (row.settings ?? {}) as OidcSettings;
    const mode = settings.mode ?? 'live';

    let email: string;
    let displayName: string | undefined;

    if (mode === 'mock' || input.code.startsWith('mock:')) {
      email = (
        input.code.startsWith('mock:')
          ? input.code.slice(5)
          : settings.mockEmail ?? ''
      ).toLowerCase();
      if (!email || email === 'use-settings') {
        email = (settings.mockEmail ?? '').toLowerCase();
      }
      if (!email) {
        throw new BadRequestException(
          'Mock OIDC requires mockEmail in settings or email on start',
        );
      }
      displayName = email.split('@')[0];
    } else {
      if (!settings.issuer || !settings.clientId) {
        throw new BadRequestException('OIDC live settings incomplete');
      }
      const discovery = await this.discover(settings.issuer);
      const tokenRes = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: input.code,
          redirect_uri: this.callbackUrl(),
          client_id: settings.clientId,
          ...(settings.clientSecret
            ? { client_secret: settings.clientSecret }
            : {}),
          code_verifier: pending.codeVerifier,
        }),
      });
      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        throw new UnauthorizedException(
          `Token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`,
        );
      }
      const tokens = (await tokenRes.json()) as {
        id_token?: string;
        access_token?: string;
      };
      if (!tokens.id_token) {
        throw new UnauthorizedException('No id_token in token response');
      }
      const jwks = jose.createRemoteJWKSet(new URL(discovery.jwks_uri));
      const { payload } = await jose.jwtVerify(tokens.id_token, jwks, {
        issuer: discovery.issuer,
        audience: settings.clientId,
      });
      if (payload.nonce && payload.nonce !== pending.nonce) {
        throw new UnauthorizedException('OIDC nonce mismatch');
      }
      email = String(payload.email ?? '').toLowerCase();
      if (!email) {
        throw new UnauthorizedException('OIDC id_token missing email claim');
      }
      displayName =
        typeof payload.name === 'string'
          ? payload.name
          : email.split('@')[0];
    }

    const session = await this.identity.createSessionForEmail({
      tenantId: pending.tenantId,
      email,
      displayName,
    });

    const redirectBase = this.webOrigin();
    const dest = new URL(`${redirectBase}/auth/callback`);
    dest.searchParams.set('token', session.token);
    dest.searchParams.set('tenantId', session.user.tenantId);
    if (pending.redirectTo) dest.searchParams.set('next', pending.redirectTo);
    return { redirectUrl: dest.toString(), session };
  }

  private async discover(issuer: string): Promise<DiscoveryDoc> {
    const base = issuer.replace(/\/$/, '');
    const url = `${base}/.well-known/openid-configuration`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(
        `OIDC discovery failed for ${issuer} (${res.status})`,
      );
    }
    return (await res.json()) as DiscoveryDoc;
  }
}
