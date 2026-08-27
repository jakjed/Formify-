import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';
import { NotificationsService } from '../application/notifications.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

class UpdateOutboundEmailDto {
  @IsEmail()
  fromAddress!: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
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

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiBearerAuth('bearer')
  @Get('outbound-email')
  @ApiOperation({ summary: 'Outbound From address for approval emails (admin)' })
  getOutboundEmail(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    assertAdmin(user);
    return this.notifications.getOutboundEmail(tenantId);
  }

  @ApiBearerAuth('bearer')
  @Patch('outbound-email')
  @ApiOperation({ summary: 'Configure outbound notification email (admin)' })
  updateOutboundEmail(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOutboundEmailDto,
  ) {
    assertAdmin(user);
    return this.notifications.upsertOutboundEmail(tenantId, dto);
  }

  @ApiBearerAuth('bearer')
  @Get()
  list(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.listForUser(
      tenantId,
      user.id,
      unreadOnly === 'true',
    );
  }

  @ApiBearerAuth('bearer')
  @Post('read-all')
  markAll(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notifications.markAllRead(tenantId, user.id);
  }

  @ApiBearerAuth('bearer')
  @Post(':id/read')
  markRead(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(tenantId, user.id, id);
  }
}
