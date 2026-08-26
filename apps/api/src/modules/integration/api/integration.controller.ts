import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { IntegrationService } from '../application/integration.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

@Controller('integration')
export class IntegrationController {
  constructor(private readonly integration: IntegrationService) {}

  @Get('templates')
  templates() {
    return this.integration.listTemplates();
  }

  @Get('templates/:key/download')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  templateFile(@Param('key') key: string, @Res({ passthrough: true }) res: Response) {
    const file = this.integration.templateCsv(key);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    return new StreamableFile(Buffer.from(file.content, 'utf8'));
  }

  @Get('jobs')
  jobs(@CurrentTenantId() tenantId: string) {
    return this.integration.listJobs(tenantId);
  }

  @Post('exports/approved-invoices')
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
}
