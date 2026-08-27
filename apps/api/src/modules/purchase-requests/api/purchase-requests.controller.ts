import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseRequestStatus } from '@prisma/client';
import { PurchaseRequestsService } from '../application/purchase-requests.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import {
  ModuleLicenseGuard,
  RequireModule,
} from '../../../common/module-license.guard';

class PrLineDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountMinor?: number;
}

class CreatePrDto {
  @IsString()
  @MinLength(1)
  number!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalMinor?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrLineDto)
  lines?: PrLineDto[];
}

class TransitionDto {
  @IsIn(['draft', 'in_approval', 'approved', 'cancelled'])
  status!: PurchaseRequestStatus;
}

class ConvertPrDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  number?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;
}

@ApiTags('purchase-requests')
@ApiBearerAuth('bearer')
@RequireModule('purchase_requests')
@UseGuards(ModuleLicenseGuard)
@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly prs: PurchaseRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List purchase requests' })
  list(@CurrentTenantId() tenantId: string) {
    return this.prs.list(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create purchase request' })
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePrDto,
  ) {
    return this.prs.create(tenantId, user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase request' })
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.prs.get(tenantId, id);
  }

  @Post(':id/convert')
  @ApiOperation({
    summary: 'Convert approved PR to draft PO (requires purchase_orders license)',
  })
  convert(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ConvertPrDto,
  ) {
    return this.prs.convertToPo(tenantId, id, user.id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition PR status' })
  transition(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.prs.transition(tenantId, id, user.id, dto.status);
  }
}
