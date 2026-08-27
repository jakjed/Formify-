import { Module } from '@nestjs/common';
import { ApiKeysController } from './api/apikeys.controller';
import { ApiKeysService } from './application/apikeys.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
