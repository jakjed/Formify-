import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { IntegrationService } from '../application/integration.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { RequireScopes } from '../../../common/scopes.decorator';

@ApiTags('integration')
@ApiBearerAuth('bearer')
@Controller('integration')
export class IntegrationController {
  constructor(private readonly integration: IntegrationService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List Integration Center templates' })
  templates() {
    return this.integration.listTemplates();
  }

  @Get('templates/:key/download')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Download a CSV template' })
  templateFile(
    @Param('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = this.integration.templateCsv(key);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    return new StreamableFile(Buffer.from(file.content, 'utf8'));
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List import/export jobs' })
  jobs(@CurrentTenantId() tenantId: string) {
    return this.integration.listJobs(tenantId);
  }

  @Post('exports/approved-invoices')
  @RequireScopes('exports:read')
  @ApiOperation({ summary: 'Export approved invoices as CSV' })
  async exportApproved(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.integration.exportApprovedInvoices(
      tenantId,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader('X-Aptora-Job-Id', result.job.id);
    res.setHeader('X-Aptora-Row-Count', String(result.rowCount));
    return new StreamableFile(Buffer.from(result.content, 'utf8'));
  }

  @Post('imports/vendors')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Import vendors from CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importVendors(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile()
    file: { originalname: string; buffer: Buffer },
  ) {
    return this.integration.importVendors(tenantId, user.id, file);
  }

  @Post('imports/gl-accounts')
  @RequireScopes('masterdata:write')
  @ApiOperation({ summary: 'Import GL accounts from CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importGl(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile()
    file: { originalname: string; buffer: Buffer },
  ) {
    return this.integration.importGlAccounts(tenantId, user.id, file);
  }
}
