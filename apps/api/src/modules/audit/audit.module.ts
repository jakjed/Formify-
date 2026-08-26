import { Module } from '@nestjs/common';
import { AuditController } from './api/audit.controller';
import { AuditService } from './application/audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
