import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MasterdataService } from '../application/masterdata.service';
import { CurrentTenantId } from '../../../common/current-user.decorator';
import { RequireScopes } from '../../../common/scopes.decorator';
import {
  CreateCodeNameDto,
  CreatePaymentTermDto,
  CreateTaxCodeDto,
  CreateVendorDto,
  UpdateCodeNameDto,
  UpdatePaymentTermDto,
  UpdateTaxCodeDto,
  UpdateVendorDto,
} from './masterdata.dto';

@Controller()
export class MasterdataController {
  constructor(private readonly masterdata: MasterdataService) {}

  // Vendors
  @Get('vendors')
  listVendors(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listVendors(tenantId, includeInactive === 'true');
  }

  @Get('vendors/:id')
  getVendor(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.masterdata.getVendor(tenantId, id);
  }

  @Post('vendors')
  @RequireScopes('masterdata:write')
  createVendor(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateVendorDto,
  ) {
    return this.masterdata.createVendor(tenantId, dto);
  }

  @Patch('vendors/:id')
  @RequireScopes('masterdata:write')
  updateVendor(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.masterdata.updateVendor(tenantId, id, dto);
  }

  @Delete('vendors/:id')
  @RequireScopes('masterdata:write')
  deactivateVendor(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.masterdata.deactivateVendor(tenantId, id);
  }

  // GL
  @Get('gl-accounts')
  listGl(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listGlAccounts(tenantId, includeInactive === 'true');
  }

  @Post('gl-accounts')
  @RequireScopes('masterdata:write')
  createGl(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCodeNameDto,
  ) {
    return this.masterdata.createGlAccount(tenantId, dto);
  }

  @Patch('gl-accounts/:id')
  @RequireScopes('masterdata:write')
  updateGl(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCodeNameDto,
  ) {
    return this.masterdata.updateGlAccount(tenantId, id, dto);
  }

  // Cost centers
  @Get('cost-centers')
  listCc(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listCostCenters(tenantId, includeInactive === 'true');
  }

  @Post('cost-centers')
  @RequireScopes('masterdata:write')
  createCc(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCodeNameDto,
  ) {
    return this.masterdata.createCostCenter(tenantId, dto);
  }

  @Patch('cost-centers/:id')
  @RequireScopes('masterdata:write')
  updateCc(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCodeNameDto,
  ) {
    return this.masterdata.updateCostCenter(tenantId, id, dto);
  }

  // Tax
  @Get('tax-codes')
  listTax(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listTaxCodes(tenantId, includeInactive === 'true');
  }

  @Post('tax-codes')
  @RequireScopes('masterdata:write')
  createTax(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateTaxCodeDto,
  ) {
    return this.masterdata.createTaxCode(tenantId, dto);
  }

  @Patch('tax-codes/:id')
  @RequireScopes('masterdata:write')
  updateTax(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaxCodeDto,
  ) {
    return this.masterdata.updateTaxCode(tenantId, id, dto);
  }

  // Payment terms
  @Get('payment-terms')
  listTerms(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listPaymentTerms(
      tenantId,
      includeInactive === 'true',
    );
  }

  @Post('payment-terms')
  @RequireScopes('masterdata:write')
  createTerm(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreatePaymentTermDto,
  ) {
    return this.masterdata.createPaymentTerm(tenantId, dto);
  }

  @Patch('payment-terms/:id')
  @RequireScopes('masterdata:write')
  updateTerm(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentTermDto,
  ) {
    return this.masterdata.updatePaymentTerm(tenantId, id, dto);
  }
}
