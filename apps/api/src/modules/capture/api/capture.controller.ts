import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CaptureService } from '../application/capture.service';
import { CurrentTenantId } from '../../../common/current-user.decorator';

@Controller('capture')
export class CaptureController {
  constructor(private readonly capture: CaptureService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentTenantId() tenantId: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.capture.uploadAndExtract(tenantId, file);
  }
}
