import { Module } from '@nestjs/common';
import { CaptureController } from './api/capture.controller';
import { CaptureService } from './application/capture.service';
import { OcrService } from './application/ocr.service';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsageModule, AuditModule, NotificationsModule],
  controllers: [CaptureController],
  providers: [CaptureService, OcrService],
  exports: [CaptureService, OcrService],
})
export class CaptureModule {}
