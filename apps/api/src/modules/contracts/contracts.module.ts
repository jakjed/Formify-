import { Module } from '@nestjs/common';
import { ContractsController } from './api/contracts.controller';
import { ContractsService } from './application/contracts.service';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ModuleLicenseGuard } from '../../common/module-license.guard';

@Module({
  imports: [AuditModule, TenancyModule],
  controllers: [ContractsController],
  providers: [ContractsService, ModuleLicenseGuard],
  exports: [ContractsService],
})
export class ContractsModule {}
