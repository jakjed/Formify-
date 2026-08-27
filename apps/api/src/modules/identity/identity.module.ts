import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service';
import { OidcService } from './application/oidc.service';
import { IdentityController } from './api/identity.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [IdentityController],
  providers: [IdentityService, OidcService],
  exports: [IdentityService, OidcService],
})
export class IdentityModule {}
