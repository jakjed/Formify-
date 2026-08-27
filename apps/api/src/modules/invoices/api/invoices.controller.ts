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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
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
    @CurrentUser() user: RequestUser,
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
    @Query('entityId') entityId?: string,
  ) {
    return this.invoices.list(tenantId, {
      status,
      q,
      exceptionCode,
      hasOpenExceptions: hasOpenExceptions === 'true',
      sort,
      limit: limit ? Number(limit) : undefined,
      entityId,
      userId: user.id,
      role: user.role,
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
    @CurrentUser() user: RequestUser,
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
    @Query('entityId') entityId?: string,
  ) {
    const csv = await this.invoices.exportCsv(tenantId, {
      status,
      q,
      exceptionCode,
      hasOpenExceptions: hasOpenExceptions === 'true',
      sort,
      limit: 500,
      entityId,
      userId: user.id,
      role: user.role,
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

  @Get(':id/file')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'Stream original scanned invoice document' })
  async file(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.invoices.getFile(tenantId, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.originalName.replace(/"/g, '')}"`,
    );
    if (file.sizeBytes > 0) {
      res.setHeader('Content-Length', String(file.sizeBytes));
    }
    return new StreamableFile(file.stream);
  }

  @Get(':id/attachments')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'List supporting attachments on invoice header' })
  attachments(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.invoices.listAttachments(tenantId, id);
  }

  @Post(':id/attachments')
  @RequireScopes('invoices:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add supporting attachment to invoice header' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  addAttachment(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Body('label') label?: string,
  ) {
    return this.invoices.addAttachment(
      tenantId,
      id,
      file,
      label,
      user.id,
    );
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequireScopes('invoices:read')
  @ApiOperation({ summary: 'Stream a supporting attachment' })
  async attachmentFile(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.invoices.getAttachmentFile(
      tenantId,
      id,
      attachmentId,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.originalName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(file.stream);
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

  @Post(':id/recall')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Recall invoice from approval back to needs_review' })
  recall(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.recall(tenantId, id, user.id);
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
  approve(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.invoices.approve(tenantId, id, user.id);
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
