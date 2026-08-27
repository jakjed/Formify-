import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service';
import { IdentityController } from './api/identity.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
