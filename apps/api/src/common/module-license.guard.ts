import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ModuleKey } from '@aptora/types';
import { TenancyService } from '../modules/tenancy/application/tenancy.service';
import type { RequestUser } from '../modules/identity/domain/identity.types';

export const REQUIRED_MODULE_KEY = 'required_module';
export const RequireModule = (moduleKey: ModuleKey) =>
  SetMetadata(REQUIRED_MODULE_KEY, moduleKey);

@Injectable()
export class ModuleLicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenancy: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<ModuleKey | undefined>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!moduleKey) return true;

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant required');

    const enabled = await this.tenancy.isModuleEnabled(tenantId, moduleKey);
    if (!enabled) {
      throw new ForbiddenException(`Module "${moduleKey}" is not licensed`);
    }
    return true;
  }
}
