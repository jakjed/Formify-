import { Controller, Get } from '@nestjs/common';
import { UsageService } from '../application/usage.service';
import { CurrentTenantId } from '../../../common/current-user.decorator';

@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get('summary')
  summary(@CurrentTenantId() tenantId: string) {
    return this.usage.getUsageSummary(tenantId);
  }
}
