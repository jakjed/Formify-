import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from '../application/invoices.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { UpdateInvoiceDto, CreateInvoiceCommentDto } from './invoices.dto';
import { RequireScopes } from '../../../common/scopes.decorator';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequireScopes('invoices:read')
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
  @Get('exceptions')
  @RequireScopes('invoices:read')
  exceptions(
    @CurrentTenantId() tenantId: string,
    @Query('code') code?: string,
  ) {
    return this.invoices.listExceptionQueue(tenantId, code);
  }

  @Get(':id/validation')
  @RequireScopes('invoices:read')
  validation(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoices.validate(tenantId, id);
  }

  @Post(':id/validate')
  @RequireScopes('invoices:write')
  revalidate(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoices.validate(tenantId, id);
  }

  @Get(':id/comments')
  @RequireScopes('invoices:read')
  comments(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.listComments(tenantId, id);
  }

  @Post(':id/comments')
  @RequireScopes('invoices:write')
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
  activity(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.getActivity(tenantId, id);
  }

  @Get(':id')
  @RequireScopes('invoices:read')
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.get(tenantId, id);
  }

  @Patch(':id')
  @RequireScopes('invoices:write')
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
  resolve(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.resolveExceptions(tenantId, id, user.id);
  }

  @Post(':id/submit')
  @RequireScopes('invoices:write')
  submit(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.submit(tenantId, id, user.id);
  }

  @Post(':id/approve')
  @RequireScopes('invoices:write')
  approve(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.invoices.approve(tenantId, id);
  }

  @Post(':id/void')
  @RequireScopes('invoices:write')
  void(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.void(tenantId, id, user.id);
  }
}
