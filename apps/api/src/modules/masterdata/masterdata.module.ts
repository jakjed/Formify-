import { Module } from '@nestjs/common';
import { MasterdataController } from './api/masterdata.controller';

@Module({
  controllers: [MasterdataController],
})
export class MasterdataModule {}
