import { Module } from '@nestjs/common';
import { NotificationsController } from './api/notifications.controller';
import { NotificationsService } from './application/notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
