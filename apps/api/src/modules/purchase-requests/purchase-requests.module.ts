import { Module } from '@nestjs/common';
import { PurchaseRequestsController } from './api/purchase-requests.controller';
import { PurchaseRequestsService } from './application/purchase-requests.service';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ModuleLicenseGuard } from '../../common/module-license.guard';
import { FxRatesModule } from '../fx-rates/fx-rates.module';

@Module({
  imports: [AuditModule, TenancyModule, FxRatesModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService, ModuleLicenseGuard],
  exports: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
