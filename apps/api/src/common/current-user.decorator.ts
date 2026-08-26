import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestUser } from '../modules/identity/domain/identity.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!request.user) throw new UnauthorizedException();
    return request.user;
  },
);

export const CurrentTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!request.user?.tenantId) throw new UnauthorizedException();
    return request.user.tenantId;
  },
);
