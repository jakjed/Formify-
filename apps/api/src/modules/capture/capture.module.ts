import { Module } from '@nestjs/common';
import { CaptureController } from './api/capture.controller';
import { CaptureService } from './application/capture.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [UsageModule],
  controllers: [CaptureController],
  providers: [CaptureService],
  exports: [CaptureService],
})
export class CaptureModule {}
