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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('capture')
@Controller('capture')
export class CaptureController {
  constructor(private readonly capture: CaptureService) {}

  @ApiBearerAuth('bearer')
  @Post('upload')
  @RequireScopes('invoices:write')
  @ApiOperation({ summary: 'Upload invoice file (creates FileAsset + invoice)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
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

  @ApiBearerAuth('bearer')
  @Get('mailbox')
  @ApiOperation({ summary: 'Get capture mailbox token/address' })
  getMailbox(@CurrentTenantId() tenantId: string) {
    return this.capture.getMailbox(tenantId);
  }

  @ApiBearerAuth('bearer')
  @Post('mailbox/rotate')
  @ApiOperation({ summary: 'Rotate mailbox ingest token' })
  rotateMailbox(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.capture.rotateMailbox(tenantId, user.id);
  }

  @ApiBearerAuth('bearer')
  @Get('email-ingests')
  @ApiOperation({ summary: 'List recent email ingest jobs' })
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
  @ApiOperation({ summary: 'Public email ingest webhook (multipart)' })
  @ApiConsumes('multipart/form-data')
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
