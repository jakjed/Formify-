import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { WorkflowService } from '../application/workflow.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  autoApproveUnderMinor?: number | null;
}

class CreateApprovalRuleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  minMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  maxMinor?: number | null;

  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(UserRole)
  assigneeRole?: UserRole | null;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class UpdateApprovalRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  minMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  maxMinor?: number | null;

  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(UserRole)
  assigneeRole?: UserRole | null;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class DecideDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller()
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('workflow/policy')
  getPolicy(@CurrentTenantId() tenantId: string) {
    return this.workflow.getPolicy(tenantId);
  }

  @Patch('workflow/policy')
  updatePolicy(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.workflow.updatePolicy(tenantId, dto);
  }

  @Get('workflow/rules')
  listRules(@CurrentTenantId() tenantId: string) {
    return this.workflow.listRules(tenantId);
  }

  @Post('workflow/rules')
  createRule(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateApprovalRuleDto,
  ) {
    return this.workflow.createRule(tenantId, dto);
  }

  @Patch('workflow/rules/:id')
  updateRule(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalRuleDto,
  ) {
    return this.workflow.updateRule(tenantId, id, dto);
  }

  @Delete('workflow/rules/:id')
  deleteRule(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.workflow.deleteRule(tenantId, id);
  }

  @Get('approvals/my-work')
  myWork(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflow.myWork(tenantId, user.id);
  }

  @Post('approvals/:taskId/approve')
  approve(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Body() dto: DecideDto,
  ) {
    return this.workflow.decideTask(
      tenantId,
      taskId,
      user.id,
      'approved',
      dto.comment,
    );
  }

  @Post('approvals/:taskId/reject')
  reject(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Body() dto: DecideDto,
  ) {
    return this.workflow.decideTask(
      tenantId,
      taskId,
      user.id,
      'rejected',
      dto.comment,
    );
  }
}
