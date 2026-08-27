import { Controller, Get } from '@nestjs/common';

@Controller('invoices')
export class InvoicesController {
  @Get('status')
  status() {
    return { module: 'invoices', status: 'scaffolded' };
  }
}
