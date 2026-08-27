import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import type { Response } from 'express';
import { InvoicesService } from '../application/invoices.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { UpdateInvoiceDto, CreateInvoiceCommentDto } from './invoices.dto';
import { RequireScopes } from '../../../common/scopes.decorator';

@ApiTags('invoices')
@ApiBearerAuth('bearer')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'List invoices with filters' })
  list(
    @CurrentTenantId() tenantId: string,
    @Query('status') status?: InvoiceStatus | InvoiceStatus[],
    @Query('q') q?: string,
    @Query('exceptionCode') exceptionCode?: string,
    @Query('hasOpenExceptions') hasOpenExceptions?: string,
    @Query('sort')
    sort?:
      | 'created_desc'
      | 'created_asc'
      | 'total_desc'
      | 'total_asc'
      | 'age_desc',
    @Query('limit') limit?: string,
  ) {
    return this.invoices.list(tenantId, {
      status,
      q,
      exceptionCode,
      hasOpenExceptions: hasOpenExceptions === 'true',
      sort,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Must stay above `:id` routes */
  @Get('export.csv')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'CSV export of current worklist filters' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Res({ passthrough: true }) res: Response,
    @CurrentTenantId() tenantId: string,
    @Query('status') status?: InvoiceStatus | InvoiceStatus[],
    @Query('q') q?: string,
    @Query('exceptionCode') exceptionCode?: string,
    @Query('hasOpenExceptions') hasOpenExceptions?: string,
    @Query('sort')
    sort?:
      | 'created_desc'
      | 'created_asc'
      | 'total_desc'
      | 'total_asc'
      | 'age_desc',
  ) {
    const csv = await this.invoices.exportCsv(tenantId, {
      status,
      q,
      exceptionCode,
      hasOpenExceptions: hasOpenExceptions === 'true',
      sort,
      limit: 500,
    });
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices-export.csv"`,
    );
    return csv;
  }

  /** Must stay above `:id` routes */
  @Get('exceptions')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'Exception queue' })
  exceptions(
    @CurrentTenantId() tenantId: string,
    @Query('code') code?: string,
  ) {
    return this.invoices.listExceptionQueue(tenantId, code);
  }

  @Get(':id/validation')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'Validation result for an invoice' })
  validation(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoices.validate(tenantId, id);
  }

  @Post(':id/validate')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Re-run validation' })
  revalidate(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoices.validate(tenantId, id);
  }

  @Get(':id/comments')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'List invoice comments' })
  comments(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.listComments(tenantId, id);
  }

  @Post(':id/comments')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Add invoice comment' })
  addComment(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateInvoiceCommentDto,
  ) {
    return this.invoices.addComment(tenantId, id, user.id, dto.body);
  }

  @Get(':id/activity')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'Invoice activity timeline' })
  activity(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.getActivity(tenantId, id);
  }

  @Get(':id')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'Get invoice workspace payload' })
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.get(tenantId, id);
  }

  @Patch(':id')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Update invoice fields' })
  update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(tenantId, id, {
      ...dto,
      actorUserId: user.id,
    });
  }

  @Post(':id/resolve-exceptions')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Resolve open exceptions' })
  resolve(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.resolveExceptions(tenantId, id, user.id);
  }

  @Post(':id/submit')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Submit invoice for approval' })
  submit(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.submit(tenantId, id, user.id);
  }

  @Post(':id/approve')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Approve invoice (manager path)' })
  approve(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.approve(tenantId, id);
  }

  @Post(':id/void')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Void invoice' })
  void(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.void(tenantId, id, user.id);
  }
}
