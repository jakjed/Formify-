import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { OAuthService, OAUTH_SCOPES } from '../application/oauth.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { AuditService } from '../../audit/application/audit.service';
import { Public } from '../../../common/public.decorator';

class CreateOAuthClientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  scopes!: string[];
}

class TokenDto {
  @IsString()
  @IsIn(['client_credentials'])
  grant_type!: 'client_credentials';

  @IsString()
  @MinLength(8)
  client_id!: string;

  @IsString()
  @MinLength(8)
  client_secret!: string;

  /** Optional space-delimited subset; ignored for now — full client scopes issued. */
  @IsOptional()
  @IsString()
  scope?: string;
}

function assertAdminSession(user: RequestUser) {
  if (
    user.authKind === 'api_key' ||
    user.authKind === 'oauth_client' ||
    user.role !== 'admin'
  ) {
    throw new ForbiddenException('Admin session required');
  }
}

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly audit: AuditService,
  ) {}

  @Get('scopes')
  scopes(@CurrentUser() user: RequestUser) {
    assertAdminSession(user);
    return [...OAUTH_SCOPES];
  }

  @Get('clients')
  list(@CurrentTenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    assertAdminSession(user);
    return this.oauth.listClients(tenantId);
  }

  @Post('clients')
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateOAuthClientDto,
  ) {
    assertAdminSession(user);
    const created = await this.oauth.createClient({
      tenantId,
      name: dto.name,
      scopes: dto.scopes,
      createdById: user.id,
    });
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'oauth.client.created',
      entityType: 'OAuthClient',
      entityId: created.id,
      meta: { name: created.name, scopes: created.scopes },
    });
    return created;
  }

  @Post('clients/:id/revoke')
  async revoke(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    assertAdminSession(user);
    const revoked = await this.oauth.revokeClient(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'oauth.client.revoked',
      entityType: 'OAuthClient',
      entityId: id,
    });
    return revoked;
  }

  @Public()
  @Post('token')
  token(@Body() dto: TokenDto) {
    return this.oauth.issueClientCredentialsToken({
      clientId: dto.client_id,
      clientSecret: dto.client_secret,
    });
  }
}
