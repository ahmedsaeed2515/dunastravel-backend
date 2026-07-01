import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateItineraryDto {
  @ApiProperty({ description: 'List of destinations (e.g. Cairo, Luxor)' })
  @IsArray()
  @IsString({ each: true })
  destinations!: string[];

  @ApiProperty({ description: 'Number of days' })
  @IsNumber()
  @Min(1)
  days!: number;

  @ApiPropertyOptional({ description: 'Total budget in USD' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  budgetUsd?: number;

  @ApiPropertyOptional({ description: 'Number of travelers' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pax?: number;

  @ApiPropertyOptional({ description: 'Special notes or preferences' })
  @IsOptional()
  @IsString()
  preferences?: string;
}

export class AnalyzeCustomerDto {
  @ApiProperty({ description: 'The Customer ID to analyze' })
  @IsString()
  customerId!: string;
}
