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

  @Get('connector-packs')
  @ApiOperation({
    summary: 'List ERP connector packs (registry + availability)',
  })
  connectorPacks() {
    return this.integration.listConnectorPacks();
  }

  @Get('connections')
  @ApiOperation({ summary: 'List connector connections for this tenant' })
  connections(@CurrentTenantId() tenantId: string) {
    return this.integration.listConnections(tenantId);
  }

  @Post('connections/demo-erp/connect')
  @ApiOperation({
    summary: 'Mock-connect Demo ERP (returns access token once)',
  })
  connectDemoErp(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.integration.connectDemoErp(tenantId, user.id);
  }

  @Post('connections/demo-erp/disconnect')
  @ApiOperation({ summary: 'Disconnect Demo ERP' })
  disconnectDemoErp(@CurrentTenantId() tenantId: string) {
    return this.integration.disconnectDemoErp(tenantId);
  }

  @Post('connections/demo-erp/sync')
  @RequireScopes('exports:read')
  @ApiOperation({
    summary: 'Stub sync: push approved invoices to Demo ERP and record a job',
  })
  syncDemoErp(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.integration.syncDemoErp(tenantId, user.id);
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
    return this.csvResponse(res, result);
  }

  @Post('exports/contracts')
  @RequireScopes('exports:read')
  @ApiOperation({ summary: 'Export contracts as CSV (requires contracts license)' })
  async exportContracts(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.integration.exportContracts(tenantId, user.id);
    return this.csvResponse(res, result);
  }

  @Post('exports/purchase-requests')
  @RequireScopes('exports:read')
  @ApiOperation({
    summary: 'Export purchase requests as CSV (requires purchase_requests license)',
  })
  async exportPrs(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.integration.exportPurchaseRequests(
      tenantId,
      user.id,
    );
    return this.csvResponse(res, result);
  }

  @Post('exports/purchase-orders')
  @RequireScopes('exports:read')
  @ApiOperation({
    summary: 'Export purchase orders as CSV (requires purchase_orders license)',
  })
  async exportPos(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.integration.exportPurchaseOrders(
      tenantId,
      user.id,
    );
    return this.csvResponse(res, result);
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

  private csvResponse(
    res: Response,
    result: {
      job: { id: string };
      fileName: string;
      content: string;
      rowCount: number;
    },
  ) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader('X-Aptora-Job-Id', result.job.id);
    res.setHeader('X-Aptora-Row-Count', String(result.rowCount));
    return new StreamableFile(Buffer.from(result.content, 'utf8'));
  }
}
