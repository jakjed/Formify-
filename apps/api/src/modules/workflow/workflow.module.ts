import { Module } from '@nestjs/common';
import { WorkflowController } from './api/workflow.controller';
import { WorkflowService } from './application/workflow.service';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoiceRulesModule } from '../invoice-rules/invoice-rules.module';

@Module({
  imports: [UsageModule, AuditModule, NotificationsModule, InvoiceRulesModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
