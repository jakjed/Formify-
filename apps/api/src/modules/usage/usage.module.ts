import { Module } from '@nestjs/common';
import { UsageController } from './api/usage.controller';

@Module({
  controllers: [UsageController],
})
export class UsageModule {}
