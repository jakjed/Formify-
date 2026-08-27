import { Module } from '@nestjs/common';
import { InvoicesController } from './api/invoices.controller';
import { InvoicesService } from './application/invoices.service';
import { UsageModule } from '../usage/usage.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { InvoiceRulesModule } from '../invoice-rules/invoice-rules.module';
import { AuditModule } from '../audit/audit.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    UsageModule,
    WorkflowModule,
    InvoiceRulesModule,
    AuditModule,
    WebhooksModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
