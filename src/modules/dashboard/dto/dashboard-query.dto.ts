import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Start date filter (ISO string, e.g. 2026-01-01)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (ISO string, e.g. 2026-01-31)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Timezone identifier (e.g. UTC, Africa/Cairo)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['UTC', 'Africa/Cairo'])
  timezone?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsOptional()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  locale?: string;

  @ApiPropertyOptional({
    description: 'Filter by Tour Landing Page Interface Slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  interfaceSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by Tour Slug' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  tourSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by Currency (e.g. USD)' })
  @IsOptional()
  @IsIn(['USD'])
  currency?: string;

  @ApiPropertyOptional({
    description: 'Period interval for trends (daily, weekly, monthly)',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({
    description: 'Preset period filter (all, 30d, 90d, 6m, 12m, 2026, 2025)',
  })
  @IsOptional()
  @IsString()
  preset?: string;

  @ApiPropertyOptional({
    description: 'Specific year filter (e.g. 2026, 2025)',
  })
  @IsOptional()
  @IsString()
  year?: string;
}
