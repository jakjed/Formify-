import { Module } from '@nestjs/common';
import { IntegrationController } from './api/integration.controller';
import { IntegrationService } from './application/integration.service';
import { TenancyModule } from '../tenancy/tenancy.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TenancyModule, NotificationsModule],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
