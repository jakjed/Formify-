import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TenancyService } from '../application/tenancy.service';
import { CreateTenantDto } from './create-tenant.dto';
import { Public } from '../../../common/public.decorator';

@Controller('tenants')
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenancy.createTenant(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tenancy.getTenant(id);
  }

  @Get(':id/entities')
  entities(@Param('id') id: string) {
    return this.tenancy.listEntities(id);
  }
}
