import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './api/purchase-orders.controller';
import { PurchaseOrdersService } from './application/purchase-orders.service';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ModuleLicenseGuard } from '../../common/module-license.guard';

@Module({
  imports: [AuditModule, TenancyModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, ModuleLicenseGuard],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
