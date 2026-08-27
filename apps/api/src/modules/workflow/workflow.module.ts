import { Module } from '@nestjs/common';
import { WorkflowController } from './api/workflow.controller';

@Module({
  controllers: [WorkflowController],
})
export class WorkflowModule {}
