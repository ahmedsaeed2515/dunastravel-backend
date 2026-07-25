import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

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
  timezone?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({
    description: 'Filter by Tour Landing Page Interface Slug',
  })
  @IsOptional()
  @IsString()
  interfaceSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by Tour Slug' })
  @IsOptional()
  @IsString()
  tourSlug?: string;

  @ApiPropertyOptional({ description: 'Filter by Currency (e.g. USD)' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Period interval for trends (daily, weekly, monthly)',
  })
  @IsOptional()
  @IsString()
  period?: 'daily' | 'weekly' | 'monthly';
}
