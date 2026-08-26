import { Controller, Get } from '@nestjs/common';
import { InvoicesService } from '../../invoices/application/invoices.service';
import { CurrentTenantId } from '../../../common/current-user.decorator';
import { RequireScopes } from '../../../common/scopes.decorator';

@Controller('ops')
export class OpsController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('dashboard')
  @RequireScopes('invoices:read')
  dashboard(@CurrentTenantId() tenantId: string) {
    return this.invoices.getOpsDashboard(tenantId);
  }
}
