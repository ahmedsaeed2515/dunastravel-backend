import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsBoolean } from 'class-validator';

export class BulkUpdateToursDto {
  @ApiProperty({ description: 'Array of tour slugs to update' })
  @IsArray()
  @IsString({ each: true })
  slugs!: string[];

  @ApiPropertyOptional({ description: 'Publishing status to apply (PUBLISHED, DRAFT, ARCHIVED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Category to apply' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Country to apply' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Set active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
