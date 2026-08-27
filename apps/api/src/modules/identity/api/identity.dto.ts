import {
  IsBoolean,
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
}

export class LoginDto {
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
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
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsIn(['admin', 'ap_manager', 'ap_clerk', 'approver'])
  role!: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';
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
  @IsUUID()
  tenantId!: string;

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
  @IsString()
  @MinLength(8)
  password?: string;
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
