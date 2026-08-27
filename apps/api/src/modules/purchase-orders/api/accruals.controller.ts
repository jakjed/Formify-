import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApAccrualStatus } from '@prisma/client';
import { AccrualsService } from '../application/accruals.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import {
  ModuleLicenseGuard,
  RequireModule,
} from '../../../common/module-license.guard';

@ApiTags('accruals')
@ApiBearerAuth('bearer')
@RequireModule('purchase_orders')
@UseGuards(ModuleLicenseGuard)
@Controller('accruals')
export class AccrualsController {
  constructor(private readonly accruals: AccrualsService) {}

  @Get()
  @ApiOperation({ summary: 'List AP accruals' })
  list(
    @CurrentTenantId() tenantId: string,
    @Query('status') status?: ApAccrualStatus,
  ) {
    return this.accruals.listAccruals(tenantId, { status });
  }

  @Post('generate-from-open-pos')
  @ApiOperation({
    summary: 'Generate or refresh draft accruals from open POs with remaining amount',
  })
  generate(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.accruals.generateFromOpenPos(tenantId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get accrual' })
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.accruals.get(tenantId, id);
  }

  @Post(':id/send-for-approval')
  @ApiOperation({ summary: 'Send draft accrual for approval' })
  sendForApproval(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.accruals.sendForApproval(tenantId, id, user.id);
  }

  @Post(':id/advance-approval')
  @ApiOperation({ summary: 'Advance accrual approval stage' })
  advanceApproval(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.accruals.advanceApproval(tenantId, id, user.id);
  }

  @Post(':id/post-to-erp')
  @ApiOperation({ summary: 'Post approved accrual to ERP (mock)' })
  postToErp(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.accruals.postToErp(tenantId, id, user.id);
  }
}
