import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsObject,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTourItineraryDto {
  @ApiProperty({ description: 'Day label (e.g. Day 1, Day 2)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dayLabel!: string;

  @ApiPropertyOptional({
    description: 'I18n day title JSON (ar, en, es, pt, it)',
  })
  @IsOptional()
  @IsObject()
  titleJsonb?: Record<string, any>;

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
  @Min(0)
  @Max(1_000)
  sortOrder!: number;
}
