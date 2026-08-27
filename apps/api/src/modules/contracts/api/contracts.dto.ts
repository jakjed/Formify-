import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateContractDto {
  @IsString()
  @MinLength(1)
  number!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueMinor?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  entityId?: string | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  valueMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  endDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  notes?: string | null;
}

export class AmendContractDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  valueMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  endDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  notes?: string | null;
}

export class RenewContractDto {
  @IsISO8601()
  endDate!: string;
}

export class CreateContractCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
