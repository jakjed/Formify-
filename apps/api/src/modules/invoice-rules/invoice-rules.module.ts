import { Module } from '@nestjs/common';
import { InvoiceValidationService } from './application/invoice-validation.service';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [TenancyModule],
  providers: [InvoiceValidationService],
  exports: [InvoiceValidationService],
})
export class InvoiceRulesModule {}
