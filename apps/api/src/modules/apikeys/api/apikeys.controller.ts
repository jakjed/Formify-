import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsString, MinLength } from 'class-validator';
import { ApiKeysService, API_KEY_SCOPES } from '../application/apikeys.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';

class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  scopes!: string[];
}

function assertAdmin(user: RequestUser) {
  if (user.authKind === 'api_key' || user.role !== 'admin') {
    throw new ForbiddenException('Admin session required');
  }
}

@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly audit: AuditService,
  ) {}

  @Get('scopes')
  scopes(@CurrentUser() user: RequestUser) {
    assertAdmin(user);
    return [...API_KEY_SCOPES];
  }

  @Get()
  list(@CurrentTenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    assertAdmin(user);
    return this.apiKeys.list(tenantId);
  }

  @Post()
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    assertAdmin(user);
    const created = await this.apiKeys.create({
      tenantId,
      name: dto.name,
      scopes: dto.scopes,
      createdById: user.id,
    });
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'apikey.created',
      entityType: 'ApiKey',
      entityId: created.id,
      meta: { name: created.name, scopes: created.scopes },
    });
    return created;
  }

  @Post(':id/revoke')
  async revoke(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    assertAdmin(user);
    const revoked = await this.apiKeys.revoke(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'apikey.revoked',
      entityType: 'ApiKey',
      entityId: id,
    });
    return revoked;
  }
}
