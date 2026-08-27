import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankIban?: string;

  @IsOptional()
  @IsString()
  bankSwift?: string;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankIban?: string;

  @IsOptional()
  @IsString()
  bankSwift?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  paymentTermId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  taxCodeId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  glAccountId?: string | null;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateCodeNameDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}

export class UpdateCodeNameDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateGlAccountDto extends CreateCodeNameDto {
  @IsOptional()
  @IsEnum(['liability', 'expense'])
  accountType?: 'liability' | 'expense';
}

export class UpdateGlAccountDto extends UpdateCodeNameDto {
  @IsOptional()
  @IsEnum(['liability', 'expense'])
  accountType?: 'liability' | 'expense';
}

export class CreateTaxCodeDto extends CreateCodeNameDto {
  @IsInt()
  @Min(0)
  rateBps!: number;
}

export class UpdateTaxCodeDto extends UpdateCodeNameDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  rateBps?: number;
}

export class CreatePaymentTermDto extends CreateCodeNameDto {
  @IsInt()
  @Min(0)
  netDays!: number;
}

export class UpdatePaymentTermDto extends UpdateCodeNameDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  netDays?: number;
}

export class CreateExpenseCategoryDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsUUID()
  entityId!: string;

  @IsUUID()
  glAccountId!: string;

  @IsOptional()
  @IsString()
  keywords?: string;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
