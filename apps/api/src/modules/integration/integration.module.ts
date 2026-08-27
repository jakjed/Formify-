import { Module } from '@nestjs/common';
import { IntegrationController } from './api/integration.controller';
import { IntegrationService } from './application/integration.service';

@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
