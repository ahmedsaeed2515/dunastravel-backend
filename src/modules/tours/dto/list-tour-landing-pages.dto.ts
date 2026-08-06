import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const LANDING_PAGE_TYPES = ['DESTINATION', 'THEME', 'COLLECTION'] as const;
const LANDING_PAGE_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
  'INACTIVE',
] as const;
const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'] as const;

export class PublicTourLandingPagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsIn(LANDING_PAGE_TYPES)
  type?: (typeof LANDING_PAGE_TYPES)[number];

  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: (typeof SUPPORTED_LOCALES)[number] = 'en';
}

export class AdminTourLandingPagesQueryDto extends PublicTourLandingPagesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(LANDING_PAGE_STATUSES)
  status?: (typeof LANDING_PAGE_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class TourLandingPageDetailQueryDto {
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: (typeof SUPPORTED_LOCALES)[number] = 'en';
}
