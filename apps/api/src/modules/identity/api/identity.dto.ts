import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

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
