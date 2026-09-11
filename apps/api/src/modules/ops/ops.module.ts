import { Module } from '@nestjs/common';
import { OpsController } from './api/ops.controller';
import { OpsService } from './application/ops.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { FxRatesModule } from '../fx-rates/fx-rates.module';

@Module({
  imports: [InvoicesModule, FxRatesModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
