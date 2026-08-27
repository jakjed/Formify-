import { Module } from '@nestjs/common';
import { OpsController } from './api/ops.controller';
import { OpsService } from './application/ops.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
