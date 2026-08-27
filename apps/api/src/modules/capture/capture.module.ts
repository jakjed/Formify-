import { Module } from '@nestjs/common';
import { CaptureController } from './api/capture.controller';
import { CaptureService } from './application/capture.service';
import { OcrService } from './application/ocr.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [UsageModule],
  controllers: [CaptureController],
  providers: [CaptureService, OcrService],
  exports: [CaptureService, OcrService],
})
export class CaptureModule {}
