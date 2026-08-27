import {
  Body,
  Controller,
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
import {
  AcceptInviteDto,
  CreateTenantUserDto,
  InviteUserDto,
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterUserDto,
  UpdateOidcProviderDto,
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
  if (user.authKind === 'api_key' || user.role !== 'admin') {
    throw new ForbiddenException('Admin session required');
  }
}

@ApiTags('auth')
@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly oidc: OidcService,
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
  ) {
    assertAdmin(user);
    return this.identity.listUsers(tenantId);
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
}
