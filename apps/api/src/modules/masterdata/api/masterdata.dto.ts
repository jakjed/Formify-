import {
  IsBoolean,
  IsEmail,
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
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

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
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  paymentTermId?: string | null;

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
}

export class UpdateCodeNameDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
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
