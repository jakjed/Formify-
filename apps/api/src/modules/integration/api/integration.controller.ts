import { Controller, Get } from '@nestjs/common';

@Controller('integration')
export class IntegrationController {
  @Get('status')
  status() {
    return { module: 'integration', status: 'scaffolded' };
  }
}
