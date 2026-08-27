import { Controller, Get } from '@nestjs/common';

@Controller('workflow')
export class WorkflowController {
  @Get('status')
  status() {
    return { module: 'workflow', status: 'scaffolded' };
  }
}
