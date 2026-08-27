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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MasterdataService } from '../application/masterdata.service';
import { CurrentTenantId } from '../../../common/current-user.decorator';
import { RequireScopes } from '../../../common/scopes.decorator';
import {
  CreateCodeNameDto,
  CreateExpenseCategoryDto,
  CreatePaymentTermDto,
  CreateTaxCodeDto,
  CreateVendorDto,
  UpdateCodeNameDto,
  UpdateExpenseCategoryDto,
  UpdatePaymentTermDto,
  UpdateTaxCodeDto,
  UpdateVendorDto,
} from './masterdata.dto';

@ApiBearerAuth('bearer')
@Controller()
export class MasterdataController {
  constructor(private readonly masterdata: MasterdataService) {}

  // Vendors
  @ApiTags('vendors')
  @Get('vendors')
  @ApiOperation({ summary: 'List vendors' })
  listVendors(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listVendors(tenantId, includeInactive === 'true');
  }

  @ApiTags('vendors')
  @Get('vendors/:id')
  @ApiOperation({ summary: 'Get vendor by id' })
  getVendor(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.masterdata.getVendor(tenantId, id);
  }

  @ApiTags('vendors')
  @Post('vendors')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create vendor' })
  createVendor(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateVendorDto,
  ) {
    return this.masterdata.createVendor(tenantId, dto);
  }

  @ApiTags('vendors')
  @Patch('vendors/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Update vendor' })
  updateVendor(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.masterdata.updateVendor(tenantId, id, dto);
  }

  @ApiTags('vendors')
  @Delete('vendors/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Deactivate vendor' })
  deactivateVendor(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.masterdata.deactivateVendor(tenantId, id);
  }

  // GL
  @ApiTags('masterdata')
  @Get('gl-accounts')
  @ApiOperation({ summary: 'List GL accounts' })
  listGl(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listGlAccounts(tenantId, includeInactive === 'true');
  }

  @ApiTags('masterdata')
  @Post('gl-accounts')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create GL account' })
  createGl(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCodeNameDto,
  ) {
    return this.masterdata.createGlAccount(tenantId, dto);
  }

  @ApiTags('masterdata')
  @Patch('gl-accounts/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Update GL account' })
  updateGl(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCodeNameDto,
  ) {
    return this.masterdata.updateGlAccount(tenantId, id, dto);
  }

  // Cost centers
  @ApiTags('masterdata')
  @Get('cost-centers')
  @ApiOperation({ summary: 'List cost centers' })
  listCc(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listCostCenters(tenantId, includeInactive === 'true');
  }

  @ApiTags('masterdata')
  @Post('cost-centers')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create cost center' })
  createCc(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCodeNameDto,
  ) {
    return this.masterdata.createCostCenter(tenantId, dto);
  }

  @ApiTags('masterdata')
  @Patch('cost-centers/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Update cost center' })
  updateCc(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCodeNameDto,
  ) {
    return this.masterdata.updateCostCenter(tenantId, id, dto);
  }

  // Tax
  @ApiTags('masterdata')
  @Get('tax-codes')
  @ApiOperation({ summary: 'List tax codes' })
  listTax(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listTaxCodes(tenantId, includeInactive === 'true');
  }

  @ApiTags('masterdata')
  @Post('tax-codes')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create tax code' })
  createTax(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateTaxCodeDto,
  ) {
    return this.masterdata.createTaxCode(tenantId, dto);
  }

  @ApiTags('masterdata')
  @Patch('tax-codes/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Update tax code' })
  updateTax(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaxCodeDto,
  ) {
    return this.masterdata.updateTaxCode(tenantId, id, dto);
  }

  // Payment terms
  @ApiTags('masterdata')
  @Get('payment-terms')
  @ApiOperation({ summary: 'List payment terms' })
  listTerms(
    @CurrentTenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.masterdata.listPaymentTerms(
      tenantId,
      includeInactive === 'true',
    );
  }

  @ApiTags('masterdata')
  @Post('payment-terms')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create payment term' })
  createTerm(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreatePaymentTermDto,
  ) {
    return this.masterdata.createPaymentTerm(tenantId, dto);
  }

  @ApiTags('masterdata')
  @Patch('payment-terms/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Update payment term' })
  updateTerm(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentTermDto,
  ) {
    return this.masterdata.updatePaymentTerm(tenantId, id, dto);
  }

  // Expense categories
  @ApiTags('masterdata')
  @Get('expense-categories')
  @ApiOperation({ summary: 'List expense categories' })
  listExpenseCategories(
    @CurrentTenantId() tenantId: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.masterdata.listExpenseCategories(tenantId, entityId);
  }

  @ApiTags('masterdata')
  @Post('expense-categories')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create expense category' })
  createExpenseCategory(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.masterdata.createExpenseCategory(tenantId, dto);
  }

  @ApiTags('masterdata')
  @Patch('expense-categories/:id')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Update expense category' })
  updateExpenseCategory(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.masterdata.updateExpenseCategory(tenantId, id, dto);
  }
}
