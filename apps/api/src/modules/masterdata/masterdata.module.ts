import { Module } from '@nestjs/common';
import { MasterdataController } from './api/masterdata.controller';
import { MasterdataService } from './application/masterdata.service';

@Module({
  controllers: [MasterdataController],
  providers: [MasterdataService],
  exports: [MasterdataService],
})
export class MasterdataModule {}
