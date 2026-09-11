import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { FxRatesService } from '../application/fx-rates.service';
import { FX_PROVIDERS } from '../domain/fx-providers';

const PROVIDER_KEYS = FX_PROVIDERS.map((p) => p.key) as [string, ...string[]];

class SyncFxDto {
  @IsOptional()
  @IsString()
  @IsIn(PROVIDER_KEYS)
  providerKey?: string;

  /** When true, also backfill gaps from 2020-01-01. */
  @IsOptional()
  @IsBoolean()
  backfill?: boolean;
}

class ActivateFxDto {
  @IsUUID()
  tableId!: string;
}

function assertAdmin(user: RequestUser) {
  if (
    user.authKind === 'api_key' ||
    user.authKind === 'oauth_client' ||
    user.role !== 'admin'
  ) {
    throw new ForbiddenException('Admin session required');
  }
}

@ApiTags('fx-rates')
@ApiBearerAuth('bearer')
@Controller('fx-rates')
export class FxRatesController {
  constructor(private readonly fx: FxRatesService) {}

  @Get()
  @ApiOperation({ summary: 'List FX rate tables and providers' })
  list(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.fx.list(tenantId);
  }

  @Get('tables/:id')
  @ApiOperation({
    summary:
      'Get FX rates for a table. Filter by year / month / day / quote. Defaults to latest rate date.',
  })
  getTable(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('year') yearRaw?: string,
    @Query('month') monthRaw?: string,
    @Query('day') dayRaw?: string,
    @Query('quote') quote?: string,
    @Query('limit') limitRaw?: string,
  ) {
    assertAdmin(user);
    const year = yearRaw ? Number(yearRaw) : undefined;
    const month = monthRaw ? Number(monthRaw) : undefined;
    const day = dayRaw ? Number(dayRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    if (yearRaw && (!Number.isInteger(year) || year! < 2020)) {
      throw new BadRequestException('Invalid year');
    }
    if (monthRaw && (!Number.isInteger(month) || month! < 1 || month! > 12)) {
      throw new BadRequestException('Invalid month');
    }
    if (dayRaw && (!Number.isInteger(day) || day! < 1 || day! > 31)) {
      throw new BadRequestException('Invalid day');
    }
    return this.fx.getTable(tenantId, id, {
      year: year != null && Number.isFinite(year) ? year : undefined,
      month: month != null && Number.isFinite(month) ? month : undefined,
      day: day != null && Number.isFinite(day) ? day : undefined,
      quote,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('activate')
  @ApiOperation({ summary: 'Select the active FX rate table for the tenant' })
  activate(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ActivateFxDto,
  ) {
    assertAdmin(user);
    return this.fx.setActive(tenantId, dto.tableId, user.id);
  }

  @Post('sync')
  @ApiOperation({
    summary:
      'Sync FX rates (history from 2020 + incremental). Omit providerKey to sync all.',
  })
  sync(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SyncFxDto,
  ) {
    assertAdmin(user);
    const opts = { backfill: dto.backfill ?? true };
    if (dto.providerKey) {
      return this.fx.sync(tenantId, dto.providerKey, user.id, opts);
    }
    return this.fx.syncAll(tenantId, user.id, opts);
  }
}
