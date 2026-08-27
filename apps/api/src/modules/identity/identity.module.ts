import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service';
import { IdentityController } from './api/identity.controller';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
