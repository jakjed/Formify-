import { Module } from '@nestjs/common';
import { OAuthController } from './api/oauth.controller';
import { OAuthService } from './application/oauth.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
