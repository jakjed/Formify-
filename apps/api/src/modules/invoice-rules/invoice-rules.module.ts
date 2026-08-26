import { Module } from '@nestjs/common';
import { InvoiceValidationService } from './application/invoice-validation.service';

@Module({
  providers: [InvoiceValidationService],
  exports: [InvoiceValidationService],
})
export class InvoiceRulesModule {}
