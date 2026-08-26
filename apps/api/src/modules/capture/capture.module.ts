import { Module } from '@nestjs/common';
import { CaptureController } from './api/capture.controller';

@Module({
  controllers: [CaptureController],
})
export class CaptureModule {}
