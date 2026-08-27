import { Module } from '@nestjs/common';
import { UsageController } from './api/usage.controller';
import { UsageService } from './application/usage.service';

@Module({
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
