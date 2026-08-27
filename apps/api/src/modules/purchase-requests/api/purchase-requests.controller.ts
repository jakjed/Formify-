import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

class UpdatePrLineDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  lineNo?: number;

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
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  sourceContractId?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  approvalStage?: number;

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

class UpdatePrDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  category?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePrLineDto)
  lines?: UpdatePrLineDto[];
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

class AcceptProposalDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalMinor?: number;

  @IsOptional()
  @IsUUID()
  entityId?: string;
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
  list(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('entityId') entityId?: string,
  ) {
    return this.prs.list(tenantId, {
      entityId,
      userId: user.id,
      role: user.role,
    });
  }

  @Get('proposals')
  @ApiOperation({
    summary: 'List active contracts available as PR proposals (no linked PR yet)',
  })
  listProposals(@CurrentTenantId() tenantId: string) {
    return this.prs.listProposals(tenantId);
  }

  @Post('proposals/:contractId/accept')
  @ApiOperation({ summary: 'Accept contract proposal into an in_approval PR' })
  acceptProposal(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('contractId') contractId: string,
    @Body() dto: AcceptProposalDto,
  ) {
    return this.prs.createFromProposal(tenantId, user.id, {
      contractId,
      ...dto,
    });
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Update draft or in_approval purchase request fields',
  })
  update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePrDto,
  ) {
    return this.prs.update(tenantId, id, user.id, dto);
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
