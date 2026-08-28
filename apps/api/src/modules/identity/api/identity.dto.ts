import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterUserDto {
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['admin', 'ap_manager', 'ap_clerk', 'approver'])
  role?: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';

  @IsOptional()
  @IsBoolean()
  canAccessDirectory?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;
}

export class LoginDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}

export class MfaVerifyDto {
  @IsString()
  @MinLength(16)
  mfaToken!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class MfaConfirmDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class MfaDisableDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class CreateTenantUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['admin', 'ap_manager', 'ap_clerk', 'approver'])
  role!: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entityIds?: string[];

  @IsOptional()
  @IsUUID()
  defaultEntityId?: string;

  @IsOptional()
  @IsBoolean()
  canAccessDirectory?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsIn(['admin', 'ap_manager', 'ap_clerk', 'approver'])
  role!: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entityIds?: string[];

  @IsOptional()
  @IsUUID()
  defaultEntityId?: string;

  @IsOptional()
  @IsBoolean()
  canAccessDirectory?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class PasswordResetRequestDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsIn(['admin', 'ap_manager', 'ap_clerk', 'approver'])
  role?: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';

  @IsOptional()
  @IsIn(['invited', 'active', 'locked'])
  status?: 'invited' | 'active' | 'locked';

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entityIds?: string[];

  @IsOptional()
  @IsUUID()
  defaultEntityId?: string;

  @IsOptional()
  @IsBoolean()
  canAccessDirectory?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;
}

export class CreateDelegationDto {
  @IsUUID()
  toUserId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateDelegationDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class OidcSettingsDto {
  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string | null;

  @IsOptional()
  @IsString()
  scopes?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsIn(['live', 'mock'])
  mode?: 'live' | 'mock';

  @IsOptional()
  @IsEmail()
  mockEmail?: string;
}

export class UpdateOidcProviderDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => OidcSettingsDto)
  settings?: OidcSettingsDto;
}

export class SamlSettingsDto {
  @IsOptional()
  @IsString()
  idpEntityId?: string;

  @IsOptional()
  @IsString()
  idpSsoUrl?: string;

  @IsOptional()
  @IsString()
  idpCertificate?: string | null;

  @IsOptional()
  @IsString()
  spEntityId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsIn(['live', 'mock'])
  mode?: 'live' | 'mock';

  @IsOptional()
  @IsEmail()
  mockEmail?: string;
}

export class UpdateSamlProviderDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SamlSettingsDto)
  settings?: SamlSettingsDto;
}
