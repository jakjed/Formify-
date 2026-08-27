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
import { GlAccountType } from '@prisma/client';
import { MasterdataService } from '../application/masterdata.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import { RequireScopes } from '../../../common/scopes.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import {
  CreateCodeNameDto,
  CreateExpenseCategoryDto,
  CreateGlAccountDto,
  CreatePaymentTermDto,
  CreateTaxCodeDto,
  CreateVendorDto,
  UpdateCodeNameDto,
  UpdateExpenseCategoryDto,
  UpdateGlAccountDto,
  UpdatePaymentTermDto,
  UpdateTaxCodeDto,
  UpdateVendorDto,
} from './masterdata.dto';

@ApiBearerAuth('bearer')
@Controller()
export class MasterdataController {
  constructor(private readonly masterdata: MasterdataService) {}

  private listOpts(
    user: RequestUser,
    query: {
      includeInactive?: string;
      entityId?: string;
      q?: string;
      accountType?: string;
    },
  ) {
    return {
      includeInactive: query.includeInactive === 'true',
      entityId: query.entityId,
      q: query.q,
      accountType: query.accountType as GlAccountType | undefined,
      userId: user.id,
      role: user.role,
    };
  }

  // Vendors
  @ApiTags('vendors')
  @Get('vendors')
  @ApiOperation({ summary: 'List vendors' })
  listVendors(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
  ) {
    return this.masterdata.listVendors(
      tenantId,
      this.listOpts(user, { includeInactive, entityId, q }),
    );
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
    @CurrentUser() user: RequestUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
    @Query('accountType') accountType?: string,
  ) {
    return this.masterdata.listGlAccounts(
      tenantId,
      this.listOpts(user, { includeInactive, entityId, q, accountType }),
    );
  }

  @ApiTags('masterdata')
  @Post('gl-accounts')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Create GL account' })
  createGl(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateGlAccountDto,
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
    @Body() dto: UpdateGlAccountDto,
  ) {
    return this.masterdata.updateGlAccount(tenantId, id, dto);
  }

  // Cost centers
  @ApiTags('masterdata')
  @Get('cost-centers')
  @ApiOperation({ summary: 'List cost centers' })
  listCc(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
  ) {
    return this.masterdata.listCostCenters(
      tenantId,
      this.listOpts(user, { includeInactive, entityId, q }),
    );
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
    @CurrentUser() user: RequestUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
  ) {
    return this.masterdata.listTaxCodes(
      tenantId,
      this.listOpts(user, { includeInactive, entityId, q }),
    );
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
    @CurrentUser() user: RequestUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
  ) {
    return this.masterdata.listPaymentTerms(
      tenantId,
      this.listOpts(user, { includeInactive, entityId, q }),
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
