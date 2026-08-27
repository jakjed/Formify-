import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdentityService } from '../application/identity.service';
import { OidcService } from '../application/oidc.service';
import { SamlService } from '../application/saml.service';
import {
  AcceptInviteDto,
  CreateDelegationDto,
  CreateTenantUserDto,
  InviteUserDto,
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterUserDto,
  UpdateDelegationDto,
  UpdateOidcProviderDto,
  UpdateSamlProviderDto,
  UpdateTenantUserDto,
} from './identity.dto';
import { Public } from '../../../common/public.decorator';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../domain/identity.types';
import { AuditService } from '../../audit/application/audit.service';

function assertAdmin(user: RequestUser) {
  if (
    user.authKind === 'api_key' ||
    user.authKind === 'oauth_client' ||
    user.role !== 'admin'
  ) {
    throw new ForbiddenException('Admin session required');
  }
}

@ApiTags('auth')
@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly oidc: OidcService,
    private readonly saml: SamlService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('auth/providers')
  @ApiOperation({ summary: 'List auth providers for a tenant (secrets redacted)' })
  providers(@Query('tenantId') tenantId?: string) {
    return this.identity.getAuthProviders(tenantId);
  }

  @ApiBearerAuth('bearer')
  @Get('auth/providers/admin')
  @ApiOperation({ summary: 'Admin view of auth provider configs' })
  providersAdmin(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.identity.listProvidersAdmin(tenantId);
  }

  @ApiBearerAuth('bearer')
  @Patch('auth/providers/oidc')
  @ApiOperation({ summary: 'Enable/configure OIDC SSO for the tenant' })
  async updateOidc(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOidcProviderDto,
  ) {
    assertAdmin(user);
    const updated = await this.identity.updateOidcProvider(tenantId, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'auth.oidc_updated',
      entityType: 'AuthProviderConfig',
      meta: { enabled: updated.enabled, mode: updated.settings.mode },
    });
    return updated;
  }

  @ApiBearerAuth('bearer')
  @Patch('auth/providers/saml')
  @ApiOperation({ summary: 'Enable/configure SAML 2.0 SSO for the tenant' })
  async updateSaml(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSamlProviderDto,
  ) {
    assertAdmin(user);
    const updated = await this.identity.updateSamlProvider(tenantId, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'auth.saml_updated',
      entityType: 'AuthProviderConfig',
      meta: { enabled: updated.enabled, mode: updated.settings.mode },
    });
    return updated;
  }

  @Public()
  @Get('auth/saml/metadata')
  @ApiOperation({ summary: 'SP metadata for SAML IdP configuration' })
  samlMetadata(
    @Query('tenantId') tenantId: string | undefined,
    @Res() res: Response,
  ) {
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }
    res.type('application/xml');
    return res.send(this.saml.metadata(tenantId));
  }

  @Public()
  @Get('auth/saml/start')
  @ApiOperation({ summary: 'Begin SAML SP-initiated flow' })
  async samlStart(
    @Query('tenantId') tenantId: string,
    @Query('email') email: string | undefined,
    @Res() res: Response,
  ) {
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }
    const { redirectUrl } = await this.saml.start(tenantId, { email });
    return res.redirect(redirectUrl);
  }

  @Public()
  @Get('auth/saml/acs')
  @ApiOperation({ summary: 'SAML ACS (mock/dev GET handler)' })
  async samlAcsGet(
    @Query('SAMLResponse') samlResponse: string | undefined,
    @Query('RelayState') relayState: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleSamlAcs(res, samlResponse, relayState);
  }

  @Public()
  @Post('auth/saml/acs')
  @ApiOperation({ summary: 'SAML ACS (HTTP-POST binding)' })
  async samlAcsPost(
    @Body('SAMLResponse') samlResponse: string | undefined,
    @Body('RelayState') relayState: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleSamlAcs(res, samlResponse, relayState);
  }

  private async handleSamlAcs(
    res: Response,
    samlResponse?: string,
    relayState?: string,
  ) {
    try {
      const result = await this.saml.acs({
        SAMLResponse: samlResponse,
        RelayState: relayState,
      });
      await this.audit.record({
        tenantId: result.session.user.tenantId,
        actorId: result.session.user.id,
        action: 'auth.saml_login',
        entityType: 'User',
        entityId: result.session.user.id,
        meta: { email: result.session.user.email },
      });
      return res.redirect(result.redirectUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'SAML login failed';
      const web =
        process.env.WEB_ORIGIN?.split(',')[0]?.trim() ??
        'http://127.0.0.1:5173';
      const dest = new URL(`${web.replace(/\/$/, '')}/login`);
      dest.searchParams.set('ssoError', message);
      return res.redirect(dest.toString());
    }
  }

  @Public()
  @Get('auth/oidc/start')
  @ApiOperation({ summary: 'Begin OIDC Authorization Code + PKCE flow' })
  async oidcStart(
    @Query('tenantId') tenantId: string,
    @Query('email') email: string | undefined,
    @Res() res: Response,
  ) {
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }
    const { redirectUrl } = await this.oidc.start(tenantId, { email });
    return res.redirect(redirectUrl);
  }

  @Public()
  @Get('auth/oidc/callback')
  @ApiOperation({ summary: 'OIDC callback — exchanges code and redirects to web' })
  async oidcCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const result = await this.oidc.callback({ code, state, error });
      await this.audit.record({
        tenantId: result.session.user.tenantId,
        actorId: result.session.user.id,
        action: 'auth.oidc_login',
        entityType: 'User',
        entityId: result.session.user.id,
        meta: { email: result.session.user.email },
      });
      return res.redirect(result.redirectUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'OIDC login failed';
      const web =
        process.env.WEB_ORIGIN?.split(',')[0]?.trim() ??
        'http://127.0.0.1:5173';
      const dest = new URL(`${web.replace(/\/$/, '')}/login`);
      dest.searchParams.set('ssoError', message);
      return res.redirect(dest.toString());
    }
  }

  @Public()
  @Post('auth/register')
  @ApiOperation({ summary: 'Register first admin user for a tenant' })
  register(@Body() dto: RegisterUserDto) {
    return this.identity.register(dto);
  }

  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: 'Create a session (bearer token)' })
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }

  @Public()
  @Get('auth/invite/:token')
  @ApiOperation({ summary: 'Preview a user invite' })
  getInvite(@Param('token') token: string) {
    return this.identity.getInvite(token);
  }

  @Public()
  @Post('auth/invite/accept')
  @ApiOperation({ summary: 'Accept invite and set password' })
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    const result = await this.identity.acceptInvite(dto);
    await this.audit.record({
      tenantId: result.user.tenantId,
      actorId: result.user.id,
      action: 'user.invite_accepted',
      entityType: 'User',
      entityId: result.user.id,
      meta: { email: result.user.email },
    });
    return result;
  }

  @Public()
  @Post('auth/password-reset/request')
  @ApiOperation({ summary: 'Request password reset (enumeration-safe)' })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.identity.requestPasswordReset(dto);
  }

  @Public()
  @Get('auth/password-reset/:token')
  @ApiOperation({ summary: 'Preview a password reset token' })
  getPasswordReset(@Param('token') token: string) {
    return this.identity.getPasswordReset(token);
  }

  @Public()
  @Post('auth/password-reset/confirm')
  @ApiOperation({ summary: 'Confirm password reset' })
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    const result = await this.identity.confirmPasswordReset(dto);
    return result;
  }

  @ApiBearerAuth('bearer')
  @Get('auth/me')
  @ApiOperation({ summary: 'Current session or API-key principal' })
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @ApiBearerAuth('bearer')
  @Get('users')
  @ApiOperation({ summary: 'List tenant users (admin)' })
  listUsers(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
  ) {
    assertAdmin(user);
    return this.identity.listUsers(tenantId, q);
  }

  @ApiBearerAuth('bearer')
  @Post('users')
  @ApiOperation({ summary: 'Create user with password (admin)' })
  async createUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTenantUserDto,
  ) {
    assertAdmin(user);
    const created = await this.identity.createUser({
      tenantId,
      email: dto.email,
      displayName: dto.displayName,
      password: dto.password,
      role: dto.role,
      entityIds: dto.entityIds,
      defaultEntityId: dto.defaultEntityId,
      canAccessDirectory: dto.canAccessDirectory,
      canApprove: dto.canApprove,
    });
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'user.created',
      entityType: 'User',
      entityId: created.id,
      meta: { email: created.email, role: created.role },
    });
    return created;
  }

  @ApiBearerAuth('bearer')
  @Post('users/invite')
  @ApiOperation({ summary: 'Invite user without password (admin)' })
  async inviteUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteUserDto,
  ) {
    assertAdmin(user);
    const invited = await this.identity.inviteUser({
      tenantId,
      email: dto.email,
      displayName: dto.displayName,
      role: dto.role,
      invitedById: user.id,
      entityIds: dto.entityIds,
      defaultEntityId: dto.defaultEntityId,
      canAccessDirectory: dto.canAccessDirectory,
      canApprove: dto.canApprove,
    });
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'user.invited',
      entityType: 'User',
      entityId: invited.user.id,
      meta: { email: invited.user.email, role: invited.user.role },
    });
    return invited;
  }

  @ApiBearerAuth('bearer')
  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user (admin)' })
  async updateUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantUserDto,
  ) {
    assertAdmin(user);
    const updated = await this.identity.updateUser(tenantId, id, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'user.updated',
      entityType: 'User',
      entityId: id,
      meta: { role: updated.role, status: updated.status },
    });
    return updated;
  }

  @ApiBearerAuth('bearer')
  @Get('delegations/candidates')
  @ApiOperation({ summary: 'Users eligible as delegation targets' })
  listDelegationCandidates(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.identity.listDelegationCandidates(tenantId, user.id);
  }

  @ApiBearerAuth('bearer')
  @Get('delegations')
  @ApiOperation({ summary: 'List approval delegations for current user' })
  listDelegations(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('all') all?: string,
  ) {
    const listAll = all === 'true' || all === '1';
    if (listAll) {
      assertAdmin(user);
    }
    return this.identity.listDelegations(tenantId, user.id, {
      all: listAll,
      isAdmin: user.role === 'admin',
    });
  }

  @ApiBearerAuth('bearer')
  @Post('delegations')
  @ApiOperation({ summary: 'Create an approval delegation from current user' })
  async createDelegation(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDelegationDto,
  ) {
    const created = await this.identity.createDelegation(tenantId, user.id, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'delegation.created',
      entityType: 'ApprovalDelegation',
      entityId: created.id,
      meta: { toUserId: created.toUserId, startsAt: created.startsAt, endsAt: created.endsAt },
    });
    return created;
  }

  @ApiBearerAuth('bearer')
  @Patch('delegations/:id')
  @ApiOperation({ summary: 'Update an approval delegation (e.g. deactivate)' })
  async updateDelegation(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateDelegationDto,
  ) {
    const updated = await this.identity.updateDelegation(
      tenantId,
      id,
      user.id,
      dto,
      user.role === 'admin',
    );
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'delegation.updated',
      entityType: 'ApprovalDelegation',
      entityId: id,
      meta: { active: updated.active },
    });
    return updated;
  }

  @ApiBearerAuth('bearer')
  @Delete('delegations/:id')
  @ApiOperation({ summary: 'Revoke an approval delegation' })
  async revokeDelegation(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const result = await this.identity.revokeDelegation(
      tenantId,
      id,
      user.id,
      user.role === 'admin',
    );
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'delegation.revoked',
      entityType: 'ApprovalDelegation',
      entityId: id,
    });
    return result;
  }
}
