import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateItineraryDto {
  @ApiProperty({ description: 'List of destinations (e.g. Cairo, Luxor)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  destinations!: string[];

  @ApiProperty({ description: 'Number of days' })
  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;

  @ApiPropertyOptional({ description: 'Total budget in USD' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000_000)
  budgetUsd?: number;

  @ApiPropertyOptional({ description: 'Number of travelers' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pax?: number;

  @ApiPropertyOptional({ description: 'Special notes or preferences' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  preferences?: string;
}

export class AnalyzeCustomerDto {
  @ApiProperty({ description: 'The Customer ID to analyze' })
  @IsString()
  customerId!: string;
}
