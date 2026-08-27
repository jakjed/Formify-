import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from '../../invoices/application/invoices.service';
import { OpsService } from '../application/ops.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import { RequireScopes } from '../../../common/scopes.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

@ApiTags('ops')
@ApiBearerAuth('bearer')
@Controller('ops')
export class OpsController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly ops: OpsService,
  ) {}

  @Get('dashboard')
  @RequireScopes('invoices:read')
  dashboard(@CurrentTenantId() tenantId: string) {
    return this.invoices.getOpsDashboard(tenantId);
  }

  @Get('command-center')
  @ApiOperation({
    summary: 'Cross-module worklist counts for the command center',
  })
  commandCenter(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ops.getCommandCenter(tenantId, user.id);
  }
}
