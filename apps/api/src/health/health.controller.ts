import { Controller, Get } from '@nestjs/common';
import { PRODUCT_NAME, PHASE1_MODULES } from '@aptora/types';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      product: PRODUCT_NAME,
      phase1Modules: PHASE1_MODULES,
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
