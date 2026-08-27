import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateInvoiceDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  vendorNameRaw?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  invoiceNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  invoiceDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  subtotalMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  taxMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  totalMinor?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  notes?: string | null;
}
