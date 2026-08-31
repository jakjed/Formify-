import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRED_SCOPES_KEY } from './scopes.decorator';
import { IdentityService } from '../modules/identity/application/identity.service';
import { ApiKeysService } from '../modules/apikeys/application/apikeys.service';
import { OAuthService } from '../modules/oauth/application/oauth.service';
import type { RequestUser } from '../modules/identity/domain/identity.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identity: IdentityService,
    private readonly apiKeys: ApiKeysService,
    private readonly oauth: OAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: RequestUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('Missing bearer token');

    if (token.startsWith('pl_') || token.startsWith('aptora_')) {
      const principal = await this.apiKeys.resolveBearer(token);
      if (!principal) throw new UnauthorizedException('Invalid API key');
      request.user = principal;
      this.assertScopes(context, principal);
      return true;
    }

    if (token.startsWith('aptoauth_')) {
      const principal = await this.oauth.resolveBearer(token);
      if (!principal) throw new UnauthorizedException('Invalid access token');
      request.user = principal;
      this.assertScopes(context, principal);
      return true;
    }

    const session = await this.identity.getSession(token);
    if (!session) throw new UnauthorizedException('Invalid session');

    const user = await this.identity.getUserById(session.userId);
    if (!user || user.tenantId !== session.tenantId) {
      throw new UnauthorizedException('Invalid session');
    }

    request.user = { ...user, authKind: 'session' };
    return true;
  }

  private assertScopes(context: ExecutionContext, principal: RequestUser) {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return;
    const ok = required.every((scope) => principal.scopes?.includes(scope));
    if (!ok) {
      throw new ForbiddenException(
        `Missing scope(s): ${required.join(', ')}`,
      );
    }
  }
}
