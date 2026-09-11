import { Module } from '@nestjs/common';
import { WorkflowController } from './api/workflow.controller';
import { WorkflowService } from './application/workflow.service';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoiceRulesModule } from '../invoice-rules/invoice-rules.module';
import { FxRatesModule } from '../fx-rates/fx-rates.module';

@Module({
  imports: [
    UsageModule,
    AuditModule,
    NotificationsModule,
    InvoiceRulesModule,
    FxRatesModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
