import { Module } from '@nestjs/common';
import { ContractsController } from './api/contracts.controller';
import { ContractsService } from './application/contracts.service';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CaptureModule } from '../capture/capture.module';
import { ModuleLicenseGuard } from '../../common/module-license.guard';

@Module({
  imports: [AuditModule, TenancyModule, CaptureModule],
  controllers: [ContractsController],
  providers: [ContractsService, ModuleLicenseGuard],
  exports: [ContractsService],
})
export class ContractsModule {}
