import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional()
  @IsIn(['us', 'eu'])
  region?: 'us' | 'eu';

  @IsOptional()
  @IsString()
  setupToken?: string;
}
