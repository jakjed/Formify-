import { Controller, Get } from '@nestjs/common';

@Controller('audit')
export class AuditController {
  @Get('status')
  status() {
    return { module: 'audit', status: 'scaffolded' };
  }
}
