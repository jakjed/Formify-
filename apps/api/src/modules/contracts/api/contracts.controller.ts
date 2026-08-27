import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { ContractStatus } from '@prisma/client';
import { ContractsService } from '../application/contracts.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { RequireModule } from '../../../common/module-license.guard';
import { ModuleLicenseGuard } from '../../../common/module-license.guard';

class CreateContractDto {
  @IsString()
  @MinLength(1)
  number!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueMinor?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class TransitionDto {
  @IsIn(['draft', 'in_approval', 'active', 'expired', 'cancelled'])
  status!: ContractStatus;
}

@ApiTags('contracts')
@ApiBearerAuth('bearer')
@RequireModule('contracts')
@UseGuards(ModuleLicenseGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List contracts' })
  list(@CurrentTenantId() tenantId: string) {
    return this.contracts.list(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract' })
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.contracts.get(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create contract draft' })
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.contracts.create(tenantId, user.id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition contract status' })
  transition(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.contracts.transition(tenantId, id, user.id, dto.status);
  }
}
