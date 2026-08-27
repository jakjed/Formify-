import { Module } from '@nestjs/common';
import { PurchaseRequestsController } from './api/purchase-requests.controller';
import { PurchaseRequestsService } from './application/purchase-requests.service';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ModuleLicenseGuard } from '../../common/module-license.guard';

@Module({
  imports: [AuditModule, TenancyModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService, ModuleLicenseGuard],
  exports: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
