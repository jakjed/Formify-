import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
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
  @ApiOperation({ summary: 'Get one FX rate table with rates' })
  getTable(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertAdmin(user);
    return this.fx.getTable(tenantId, id);
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
      'Sync FX rates from free providers (NBP / ECB / FRED / BOE). Omit providerKey to sync all.',
  })
  sync(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SyncFxDto,
  ) {
    assertAdmin(user);
    if (dto.providerKey) {
      return this.fx.sync(tenantId, dto.providerKey, user.id);
    }
    return this.fx.syncAll(tenantId, user.id);
  }
}
