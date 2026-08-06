import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by booking status',
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Filter by tour ID', example: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  tourId?: string;

  @ApiPropertyOptional({
    description: 'Filter created after this date',
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter created before this date',
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Search term for customer name, email, or reference code',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by payment status (e.g. PAID, PENDING, PARTIALLY_PAID)',
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  paymentStatus?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'totalAmountUsd', 'referenceCode'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'totalAmountUsd', 'referenceCode'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Filter by assignee ID' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;
}
