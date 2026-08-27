import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { WebhooksService } from '../application/webhooks.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;
}

class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  description?: string | null;
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

@ApiTags('webhooks')
@ApiBearerAuth('bearer')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('events')
  @ApiOperation({ summary: 'List supported webhook event names' })
  events() {
    return this.webhooks.listEvents();
  }

  @Get('endpoints')
  @ApiOperation({ summary: 'List webhook endpoints' })
  list(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.webhooks.listEndpoints(tenantId);
  }

  @Post('endpoints')
  @ApiOperation({ summary: 'Create webhook endpoint (secret returned once)' })
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWebhookDto,
  ) {
    assertAdmin(user);
    return this.webhooks.createEndpoint(tenantId, dto);
  }

  @Patch('endpoints/:id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    assertAdmin(user);
    return this.webhooks.updateEndpoint(tenantId, id, dto);
  }

  @Delete('endpoints/:id')
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  remove(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    assertAdmin(user);
    return this.webhooks.deleteEndpoint(tenantId, id);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Recent webhook delivery attempts' })
  deliveries(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('endpointId') endpointId?: string,
  ) {
    assertAdmin(user);
    return this.webhooks.listDeliveries(tenantId, endpointId);
  }
}
