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
  CreateTenantUserDto,
  LoginDto,
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
      meta: { role: updated.role },
    });
    return updated;
  }
}
