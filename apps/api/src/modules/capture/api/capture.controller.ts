import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CaptureService } from '../application/capture.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import { Public } from '../../../common/public.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { RequireScopes } from '../../../common/scopes.decorator';

@Controller('capture')
export class CaptureController {
  constructor(private readonly capture: CaptureService) {}

  @Post('upload')
  @RequireScopes('invoices:write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.capture.uploadAndExtract(tenantId, file, {
      actorId: user.id,
      source: 'upload',
    });
  }

  @Get('mailbox')
  getMailbox(@CurrentTenantId() tenantId: string) {
    return this.capture.getMailbox(tenantId);
  }

  @Post('mailbox/rotate')
  rotateMailbox(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.capture.rotateMailbox(tenantId, user.id);
  }

  @Get('email-ingests')
  listIngests(
    @CurrentTenantId() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.capture.listEmailIngests(
      tenantId,
      limit ? Number(limit) : 50,
    );
  }

  @Public()
  @Post('email/:token')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  ingestEmail(
    @Param('token') token: string,
    @Body()
    body: {
      messageId?: string;
      fromAddress?: string;
      subject?: string;
    },
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Attachment file is required');
    }
    const messageId =
      body.messageId?.trim() ||
      `generated-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return this.capture.ingestEmail({
      token,
      messageId,
      fromAddress: body.fromAddress,
      subject: body.subject,
      file,
    });
  }
}
