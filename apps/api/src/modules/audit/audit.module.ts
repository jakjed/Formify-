import { Module } from '@nestjs/common';
import { AuditController } from './api/audit.controller';

@Module({
  controllers: [AuditController],
})
export class AuditModule {}
