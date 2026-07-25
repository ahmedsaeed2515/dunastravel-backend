import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAvailabilityDto {
  @ApiProperty({
    description: 'Availability date (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Total capacity for this slot',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalCapacity?: number;

  @ApiPropertyOptional({ description: 'Slot status', example: 'AVAILABLE' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateBatchAvailabilityDto {
  @ApiProperty({
    description: 'Start date (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Total capacity per slot', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalCapacity?: number;

  @ApiPropertyOptional({
    description: 'Days of week to generate (0 = Sun, 1 = Mon ... 6 = Sat)',
    example: [1, 3, 5],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ description: 'Total capacity', example: 40 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalCapacity?: number;

  @ApiPropertyOptional({ description: 'Remaining seats', example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingSeats?: number;

  @ApiPropertyOptional({ description: 'Status override', example: 'AVAILABLE' })
  @IsOptional()
  @IsString()
  status?: string;
}
