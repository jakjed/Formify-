import { Controller, Get } from '@nestjs/common';

@Controller('masterdata')
export class MasterdataController {
  @Get('status')
  status() {
    return { module: 'masterdata', status: 'scaffolded' };
  }
}
