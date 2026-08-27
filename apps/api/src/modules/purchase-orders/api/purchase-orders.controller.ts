import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrdersService } from '../application/purchase-orders.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import {
  ModuleLicenseGuard,
  RequireModule,
} from '../../../common/module-license.guard';

class PoLineDto {
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

class UpdatePoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalMinor?: number;
}

class CreatePoDto {
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
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  purchaseRequestId?: string;

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
  @Type(() => PoLineDto)
  lines?: PoLineDto[];
}

class TransitionDto {
  @IsIn(['draft', 'issued', 'received', 'closed', 'cancelled'])
  status!: PurchaseOrderStatus;
}

class ReceiveLineDto {
  @IsInt()
  @Min(1)
  lineNo!: number;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

class ReceivePoDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines?: ReceiveLineDto[];
}

@ApiTags('purchase-orders')
@ApiBearerAuth('bearer')
@RequireModule('purchase_orders')
@UseGuards(ModuleLicenseGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly pos: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  list(@CurrentTenantId() tenantId: string) {
    return this.pos.list(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create purchase order draft' })
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePoDto,
  ) {
    return this.pos.create(tenantId, user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order' })
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.pos.get(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update draft purchase order fields' })
  update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePoDto,
  ) {
    return this.pos.update(tenantId, id, user.id, dto);
  }

  @Post(':id/receive')
  @ApiOperation({
    summary: 'Receive against PO lines (partial or full); omit lines to receive all remaining',
  })
  receive(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReceivePoDto,
  ) {
    return this.pos.receive(tenantId, id, user.id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition PO status (issue / cancel / close)' })
  transition(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.pos.transition(tenantId, id, user.id, dto.status);
  }
}
