import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { TenancyService } from '../application/tenancy.service';
import { CreateTenantDto } from './create-tenant.dto';
import { Public } from '../../../common/public.decorator';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { AuditService } from '../../audit/application/audit.service';

class CreateEntityDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}

class UpdateEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;
}

class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  planName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvedSoftLimit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvedHardLimit?: number | null;
}

function assertAdmin(user: RequestUser) {
  if (user.authKind === 'api_key' || user.role !== 'admin') {
    throw new ForbiddenException('Admin session required');
  }
}

@Controller()
export class TenancyController {
  constructor(
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('tenants')
  create(@Body() dto: CreateTenantDto) {
    return this.tenancy.createTenant(dto);
  }

  @Get('tenants/:id')
  get(@Param('id') id: string) {
    return this.tenancy.getTenant(id);
  }

  @Get('tenants/:id/entities')
  entities(@Param('id') id: string) {
    return this.tenancy.listEntities(id);
  }

  @Get('entities')
  listEntities(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.tenancy.listEntities(tenantId);
  }

  @Post('entities')
  async createEntity(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateEntityDto,
  ) {
    assertAdmin(user);
    const entity = await this.tenancy.createEntity(tenantId, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'entity.created',
      entityType: 'Entity',
      entityId: entity.id,
      meta: { code: entity.code },
    });
    return entity;
  }

  @Patch('entities/:id')
  async updateEntity(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateEntityDto,
  ) {
    assertAdmin(user);
    const entity = await this.tenancy.updateEntity(tenantId, id, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'entity.updated',
      entityType: 'Entity',
      entityId: id,
    });
    return entity;
  }

  @Get('plan')
  getPlan(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.tenancy.getPlan(tenantId);
  }

  @Patch('plan')
  async updatePlan(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePlanDto,
  ) {
    assertAdmin(user);
    const plan = await this.tenancy.updatePlan(tenantId, dto);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'plan.updated',
      entityType: 'Tenant',
      entityId: tenantId,
      meta: plan,
    });
    return plan;
  }
}
