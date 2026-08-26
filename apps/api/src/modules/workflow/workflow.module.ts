import { Module } from '@nestjs/common';
import { WorkflowController } from './api/workflow.controller';
import { WorkflowService } from './application/workflow.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [UsageModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
