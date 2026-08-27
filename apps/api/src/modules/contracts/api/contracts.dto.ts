import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CONTRACT_DOC_CATEGORIES } from '../application/procure-constants';

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

  @IsOptional()
  @IsString()
  agreementType?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  serviceDescription?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  termType?: string;

  @IsOptional()
  @IsString()
  noticePeriod?: string;

  @IsOptional()
  @IsString()
  clmTool?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsISO8601()
  contractDate?: string;
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

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  agreementType?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  purpose?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  serviceDescription?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  costCenter?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  termType?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  noticePeriod?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  clmTool?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  ownerName?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  contractDate?: string | null;
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

export class AiIntakeDto {
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;
}

export class AddDocumentDto {
  @IsIn([...CONTRACT_DOC_CATEGORIES])
  category!: (typeof CONTRACT_DOC_CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  fileName!: string;
}

export class CompleteSignatureDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fileName?: string;
}
