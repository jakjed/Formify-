import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

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
