import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PublicHotelsQueryDto {
  @IsOptional()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  locale?: string = 'en';

  @IsOptional()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  lang?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationSlug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;
}

export class AdminHotelsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationSlug?: string;
}
