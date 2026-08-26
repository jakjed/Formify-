import { Module } from '@nestjs/common';
import { InvoicesController } from './api/invoices.controller';
import { InvoicesService } from './application/invoices.service';
import { UsageModule } from '../usage/usage.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [UsageModule, WorkflowModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
