import { IsString, IsInt, IsOptional, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTourItineraryDto {
  @ApiProperty({ description: 'Day label (e.g. Day 1, Day 2)' })
  @IsString()
  @IsNotEmpty()
  dayLabel!: string;

  @ApiProperty({ description: 'I18n description JSON' })
  @IsObject()
  @IsNotEmpty()
  descriptionJsonb!: Record<string, any>;

  @ApiPropertyOptional({ description: 'I18n meals JSON' })
  @IsOptional()
  @IsObject()
  mealsJsonb?: Record<string, any>;

  @ApiProperty({ description: 'Sort order for display' })
  @IsInt()
  @IsNotEmpty()
  sortOrder!: number;
}
