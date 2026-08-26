import { Module } from '@nestjs/common';
import { IntegrationController } from './api/integration.controller';

@Module({
  controllers: [IntegrationController],
})
export class IntegrationModule {}
