import { Module } from '@nestjs/common';
import { NotificationsController } from './api/notifications.controller';

@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}
