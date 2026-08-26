import { Module } from '@nestjs/common';
import { InvoicesController } from './api/invoices.controller';

@Module({
  controllers: [InvoicesController],
})
export class InvoicesModule {}
