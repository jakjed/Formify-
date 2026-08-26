import { Module } from '@nestjs/common';
import { CaptureController } from './api/capture.controller';
import { CaptureService } from './application/capture.service';
import { OcrService } from './application/ocr.service';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoiceRulesModule } from '../invoice-rules/invoice-rules.module';

@Module({
  imports: [UsageModule, AuditModule, NotificationsModule, InvoiceRulesModule],
  controllers: [CaptureController],
  providers: [CaptureService, OcrService],
  exports: [CaptureService, OcrService],
})
export class CaptureModule {}
