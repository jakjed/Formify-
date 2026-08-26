import { Controller, Get } from '@nestjs/common';
import { PRODUCT_NAME, PHASE1_MODULES } from '@aptora/types';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      product: PRODUCT_NAME,
      phase1Modules: PHASE1_MODULES,
      timestamp: new Date().toISOString(),
    };
  }
}
