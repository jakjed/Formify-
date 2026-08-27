import { Module } from '@nestjs/common';
import { TenancyService } from './application/tenancy.service';
import { TenancyController } from './api/tenancy.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
