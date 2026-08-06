import {
  IsInt,
  IsOptional,
  IsArray,
  IsEnum,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Max,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TourAvailabilityStatus } from '@prisma/client';

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalCapacity?: number;

  @ApiPropertyOptional({ description: 'Slot status', example: 'AVAILABLE' })
  @IsOptional()
  @IsEnum(TourAvailabilityStatus)
  status?: TourAvailabilityStatus;
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalCapacity?: number;

  @ApiPropertyOptional({
    description: 'Days of week to generate (0 = Sun, 1 = Mon ... 6 = Sat)',
    example: [1, 3, 5],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ description: 'Total capacity', example: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalCapacity?: number;

  @ApiPropertyOptional({ description: 'Remaining seats', example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  remainingSeats?: number;

  @ApiPropertyOptional({ description: 'Status override', example: 'AVAILABLE' })
  @IsOptional()
  @IsEnum(TourAvailabilityStatus)
  status?: TourAvailabilityStatus;
}
