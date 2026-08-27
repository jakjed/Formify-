import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../application/audit.service';
import { CurrentTenantId } from '../../../common/current-user.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  list(
    @CurrentTenantId() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(tenantId, limit ? Number(limit) : 100);
  }
}
