import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { IdentityService } from './identity.service';

export type SamlSettings = {
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpCertificate?: string;
  spEntityId?: string;
  displayName?: string;
  mode?: 'live' | 'mock';
  mockEmail?: string;
};

@Injectable()
export class SamlService {
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

  acsUrl() {
    return `${this.apiPublicBase()}/api/auth/saml/acs`;
  }

  async getSamlConfig(tenantId: string) {
    const row = await this.prisma.authProviderConfig.findUnique({
      where: { tenantId_type: { tenantId, type: 'saml' } },
    });
    if (!row) throw new NotFoundException('SAML provider not configured');
    return row;
  }

  spEntityId(tenantId: string, settings: SamlSettings) {
    return (
      settings.spEntityId?.trim() ||
      `${this.apiPublicBase()}/api/auth/saml/metadata?tenantId=${tenantId}`
    );
  }

  async start(tenantId: string, opts?: { email?: string; redirectTo?: string }) {
    const row = await this.getSamlConfig(tenantId);
    if (!row.enabled) {
      throw new BadRequestException('SAML is not enabled for this tenant');
    }
    const settings = (row.settings ?? {}) as SamlSettings;
    const mode = settings.mode ?? 'live';
    const relayState = randomBytes(24).toString('base64url');

    await this.prisma.samlAuthState.create({
      data: {
        tenantId,
        relayState,
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
        RelayState: relayState,
        SAMLResponse: `mock:${email || 'use-settings'}`,
      });
      return {
        redirectUrl: `${this.apiPublicBase()}/api/auth/saml/acs?${params}`,
      };
    }

    if (!settings.idpSsoUrl) {
      throw new BadRequestException(
        'SAML IdP SSO URL is required for live mode',
      );
    }
    const authUrl = new URL(settings.idpSsoUrl);
    authUrl.searchParams.set('RelayState', relayState);
    authUrl.searchParams.set(
      'SAMLRequest',
      Buffer.from(
        `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${relayState}" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${settings.idpSsoUrl}" AssertionConsumerServiceURL="${this.acsUrl()}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.spEntityId(tenantId, settings)}</saml:Issuer></samlp:AuthnRequest>`,
      ).toString('base64'),
    );
    return { redirectUrl: authUrl.toString() };
  }

  async acs(input: {
    SAMLResponse?: string;
    RelayState?: string;
  }) {
    if (!input.SAMLResponse || !input.RelayState) {
      throw new BadRequestException('Missing SAMLResponse or RelayState');
    }

    const pending = await this.prisma.samlAuthState.findUnique({
      where: { relayState: input.RelayState },
    });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('SAML relay state expired or unknown');
    }
    await this.prisma.samlAuthState.delete({ where: { id: pending.id } });

    const row = await this.getSamlConfig(pending.tenantId);
    if (!row.enabled) {
      throw new BadRequestException('SAML is not enabled');
    }
    const settings = (row.settings ?? {}) as SamlSettings;
    const mode = settings.mode ?? 'live';

    let email: string;
    let displayName: string | undefined;

    if (mode === 'mock' || input.SAMLResponse.startsWith('mock:')) {
      email = (
        input.SAMLResponse.startsWith('mock:')
          ? input.SAMLResponse.slice(5)
          : settings.mockEmail ?? ''
      ).toLowerCase();
      if (!email || email === 'use-settings') {
        email = (settings.mockEmail ?? '').toLowerCase();
      }
      if (!email) {
        throw new BadRequestException(
          'Mock SAML requires mockEmail in settings or email on start',
        );
      }
      displayName = email.split('@')[0];
    } else {
      throw new BadRequestException(
        'Live SAML ACS validation is not enabled in this build — use mock mode for local tests or configure OIDC',
      );
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

  metadata(tenantId: string) {
    const acs = this.acsUrl();
    const entityId = `${this.apiPublicBase()}/api/auth/saml/metadata?tenantId=${tenantId}`;
    return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }
}
