import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ScimService } from '../application/scim.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';
import { RequireScopes } from '../../../common/scopes.decorator';
import { AuditService } from '../../audit/application/audit.service';

function assertScimPrincipal(user: RequestUser) {
  if (user.authKind !== 'api_key' && user.authKind !== 'oauth_client') {
    throw new ForbiddenException(
      'SCIM requires an API key or OAuth access token with scim scopes',
    );
  }
}

@Controller('scim/v2')
export class ScimController {
  constructor(
    private readonly scim: ScimService,
    private readonly audit: AuditService,
  ) {}

  @Get('Users')
  @RequireScopes('scim:read')
  @Header('Content-Type', 'application/scim+json')
  listUsers(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    assertScimPrincipal(user);
    return this.scim.list(tenantId, {
      filter,
      startIndex: startIndex ? Number(startIndex) : undefined,
      count: count ? Number(count) : undefined,
    });
  }

  @Get('Users/:id')
  @RequireScopes('scim:read')
  @Header('Content-Type', 'application/scim+json')
  getUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    assertScimPrincipal(user);
    return this.scim.get(tenantId, id);
  }

  @Post('Users')
  @RequireScopes('scim:write')
  async createUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown> = {},
    @Res({ passthrough: true }) res: Response,
  ) {
    assertScimPrincipal(user);
    const created = await this.scim.create(tenantId, {
      userName: typeof body?.userName === 'string' ? body.userName : undefined,
      displayName:
        typeof body?.displayName === 'string' ? body.displayName : undefined,
      active: typeof body?.active === 'boolean' ? body.active : undefined,
      emails: Array.isArray(body?.emails)
        ? (body.emails as { value?: string }[])
        : undefined,
      roles: Array.isArray(body?.roles)
        ? (body.roles as { value?: string }[])
        : undefined,
    });
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'scim.user.created',
      entityType: 'User',
      entityId: created.id,
      meta: { userName: created.userName },
    });
    res.status(201);
    res.setHeader('Content-Type', 'application/scim+json');
    res.setHeader('Location', created.meta.location);
    return created;
  }

  @Patch('Users/:id')
  @RequireScopes('scim:write')
  @Header('Content-Type', 'application/scim+json')
  async patchUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      Operations?: { op?: string; path?: string; value?: unknown }[];
    } = {},
  ) {
    assertScimPrincipal(user);
    const updated = await this.scim.patch(tenantId, id, body.Operations ?? []);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'scim.user.patched',
      entityType: 'User',
      entityId: id,
    });
    return updated;
  }

  @Delete('Users/:id')
  @RequireScopes('scim:write')
  async deleteUser(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertScimPrincipal(user);
    await this.scim.deactivate(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: user.id,
      action: 'scim.user.deactivated',
      entityType: 'User',
      entityId: id,
    });
    res.status(204);
    return;
  }
}
