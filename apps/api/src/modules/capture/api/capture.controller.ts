import { Controller, Get } from '@nestjs/common';

@Controller('capture')
export class CaptureController {
  @Get('status')
  status() {
    return { module: 'capture', status: 'scaffolded' };
  }
}
