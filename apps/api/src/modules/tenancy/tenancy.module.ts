import { Module } from '@nestjs/common';
import { TenancyService } from './application/tenancy.service';
import { TenancyController } from './api/tenancy.controller';

@Module({
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
