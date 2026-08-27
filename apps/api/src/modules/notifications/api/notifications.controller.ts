import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NotificationsService } from '../application/notifications.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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

  @Post('read-all')
  markAll(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notifications.markAllRead(tenantId, user.id);
  }

  @Post(':id/read')
  markRead(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(tenantId, user.id, id);
  }
}
