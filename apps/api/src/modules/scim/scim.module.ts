import { Module } from '@nestjs/common';
import { ScimController } from './api/scim.controller';
import { ScimService } from './application/scim.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ScimController],
  providers: [ScimService],
})
export class ScimModule {}
