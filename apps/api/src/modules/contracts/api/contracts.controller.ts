import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ContractStatus } from '@prisma/client';
import { ContractsService } from '../application/contracts.service';
import {
  AmendContractDto,
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
  @IsIn(['draft', 'in_approval', 'active', 'expired', 'cancelled'])
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
  list(@CurrentTenantId() tenantId: string) {
    return this.contracts.list(tenantId);
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
