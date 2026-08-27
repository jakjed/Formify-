import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ContractStatus } from '@prisma/client';
import { ContractsService } from '../application/contracts.service';
import {
  AddDocumentDto,
  AiIntakeDto,
  AmendContractDto,
  CompleteSignatureDto,
  CreateContractCommentDto,
  CreateContractDto,
  RenewContractDto,
  UpdateContractDto,
} from './contracts.dto';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import {
  ModuleLicenseGuard,
  RequireModule,
} from '../../../common/module-license.guard';

class TransitionDto {
  @IsIn([
    'draft',
    'in_approval',
    'pending_signature',
    'active',
    'expired',
    'cancelled',
  ])
  status!: ContractStatus;
}

@ApiTags('contracts')
@ApiBearerAuth('bearer')
@RequireModule('contracts')
@UseGuards(ModuleLicenseGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List contracts' })
  list(
    @CurrentTenantId() tenantId: string,
    @Query('status') status?: ContractStatus,
    @Query('q') q?: string,
  ) {
    return this.contracts.list(tenantId, { status, q });
  }

  @Post()
  @ApiOperation({ summary: 'Create contract draft' })
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.contracts.create(tenantId, user.id, dto);
  }

  @Post('ai-intake')
  @ApiOperation({ summary: 'Create draft contract from AI document intake (stub)' })
  aiIntake(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: AiIntakeDto,
  ) {
    return this.contracts.aiIntake(tenantId, user.id, dto);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List contract comments' })
  comments(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.contracts.listComments(tenantId, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add contract comment' })
  addComment(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateContractCommentDto,
  ) {
    return this.contracts.addComment(tenantId, id, user.id, dto.body);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Contract activity timeline' })
  activity(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.contracts.getActivity(tenantId, id);
  }

  @Post(':id/send-for-approval')
  @ApiOperation({ summary: 'Send draft contract for approval' })
  sendForApproval(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contracts.sendForApproval(tenantId, id, user.id);
  }

  @Post(':id/advance-approval')
  @ApiOperation({ summary: 'Advance contract approval stage' })
  advanceApproval(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contracts.advanceApproval(tenantId, id, user.id);
  }

  @Post(':id/send-for-signature')
  @ApiOperation({ summary: 'Send contract for e-signature (mock DocuSign)' })
  sendForSignature(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contracts.sendForSignature(tenantId, id, user.id);
  }

  @Post(':id/check-signature')
  @ApiOperation({ summary: 'Poll signature status (mock: mark next signer Signed)' })
  checkSignature(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contracts.checkSignatureStatus(tenantId, id, user.id);
  }

  @Post(':id/complete-signature')
  @ApiOperation({ summary: 'Complete signature and activate contract' })
  completeSignature(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CompleteSignatureDto,
  ) {
    return this.contracts.completeSignature(tenantId, id, user.id, dto);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Add contract document metadata' })
  addDocument(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AddDocumentDto,
  ) {
    return this.contracts.addDocument(tenantId, id, user.id, dto);
  }

  @Delete(':id/documents/:docId')
  @ApiOperation({ summary: 'Remove contract document' })
  removeDocument(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.contracts.removeDocument(tenantId, id, docId, user.id);
  }

  @Post(':id/ai-summarize')
  @ApiOperation({ summary: 'AI multi-function contract summary (stub)' })
  aiSummarize(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.contracts.aiSummarize(tenantId, id);
  }

  @Post(':id/scan-red-flags')
  @ApiOperation({ summary: 'Scan contract for red flags (stub)' })
  scanRedFlags(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contracts.scanRedFlags(tenantId, id, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract workspace payload' })
  get(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.contracts.get(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contract fields (draft / in_approval)' })
  update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contracts.update(tenantId, id, user.id, dto);
  }

  @Post(':id/amend')
  @ApiOperation({ summary: 'Amend an active contract' })
  amend(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AmendContractDto,
  ) {
    return this.contracts.amend(tenantId, id, user.id, dto);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renew an active contract end date' })
  renew(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RenewContractDto,
  ) {
    return this.contracts.renew(tenantId, id, user.id, dto.endDate);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition contract status' })
  transition(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.contracts.transition(tenantId, id, user.id, dto.status);
  }
}
