import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IdentityService } from '../application/identity.service';
import {
  AcceptInviteDto,
  CreateTenantUserDto,
  InviteUserDto,
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterUserDto,
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

@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('auth/providers')
  providers() {
    return this.identity.getAuthProviders();
  }

  @Public()
  @Post('auth/register')
  register(@Body() dto: RegisterUserDto) {
    return this.identity.register(dto);
  }

  @Public()
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }

  @Public()
  @Get('auth/invite/:token')
  getInvite(@Param('token') token: string) {
    return this.identity.getInvite(token);
  }

  @Public()
  @Post('auth/invite/accept')
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
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.identity.requestPasswordReset(dto);
  }

  @Public()
  @Get('auth/password-reset/:token')
  getPasswordReset(@Param('token') token: string) {
    return this.identity.getPasswordReset(token);
  }

  @Public()
  @Post('auth/password-reset/confirm')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    const result = await this.identity.confirmPasswordReset(dto);
    return result;
  }

  @Get('auth/me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Get('users')
  listUsers(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.identity.listUsers(tenantId);
  }

  @Post('users')
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

  @Post('users/invite')
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

  @Patch('users/:id')
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
