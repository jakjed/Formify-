import { Module } from '@nestjs/common';
import { OpsController } from './api/ops.controller';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [OpsController],
})
export class OpsModule {}
