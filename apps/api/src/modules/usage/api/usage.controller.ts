import { Controller, Get } from '@nestjs/common';

@Controller('usage')
export class UsageController {
  @Get('status')
  status() {
    return { module: 'usage', status: 'scaffolded' };
  }
}
