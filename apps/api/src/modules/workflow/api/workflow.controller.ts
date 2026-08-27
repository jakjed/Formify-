import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
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
