import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './api/purchase-orders.controller';
import { AccrualsController } from './api/accruals.controller';
import { PurchaseOrdersService } from './application/purchase-orders.service';
import { AccrualsService } from './application/accruals.service';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ModuleLicenseGuard } from '../../common/module-license.guard';

@Module({
  imports: [AuditModule, TenancyModule],
  controllers: [PurchaseOrdersController, AccrualsController],
  providers: [PurchaseOrdersService, AccrualsService, ModuleLicenseGuard],
  exports: [PurchaseOrdersService, AccrualsService],
})
export class PurchaseOrdersModule {}
