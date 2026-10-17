import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateTransportationServiceDto {
  @ApiProperty({ description: 'Primary vehicle or service name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description:
      'Localized names dictionary in 5 languages: ar, en, es, pt, it',
    type: Object,
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  nameJsonb?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Arabic name shorthand' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ description: 'English name shorthand' })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiProperty({
    description: 'Service type',
    enum: [
      'AIRPORT',
      'HOTEL',
      'CITY_TO_CITY',
      'FULL_DAY',
      'VIP_ESCORT',
      'COASTER',
      'BUS',
      'PRIVATE',
    ],
    default: 'AIRPORT',
  })
  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @ApiPropertyOptional({
    description: 'Vehicle category',
    enum: [
      'bus',
      'coaster',
      'private',
      'transfer',
      'luxury_van',
      'sedan',
      'suv',
    ],
    default: 'bus',
  })
  @IsOptional()
  @IsString()
  vehicleCategory?: string;

  @ApiPropertyOptional({ description: 'Vehicle model and specifications' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({
    description: 'Passenger seating capacity',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(150)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Vehicle door count', default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  doors?: number;

  @ApiPropertyOptional({
    description: 'Transmission type (AUTO or MANUAL)',
    default: 'AUTO',
  })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiProperty({
    description: 'Base price per booking/trip in USD',
    default: 150,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePriceUsd!: number;

  @ApiPropertyOptional({ description: 'Featured vehicle hero image URL' })
  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @ApiPropertyOptional({ description: 'MediaAsset ID from library' })
  @IsOptional()
  @IsString()
  heroMediaId?: string;

  @ApiPropertyOptional({
    description: 'Is private exclusive chauffeur vehicle',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'Is active and available for booking',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Vehicle overview description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Localized description dictionary in 5 languages: ar, en, es, pt, it',
    type: Object,
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  descriptionJsonb?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Pickup instructions and meeting point advice',
  })
  @IsOptional()
  @IsString()
  pickupInstructions?: string;

  @ApiPropertyOptional({
    description: 'Dropoff instructions and luggage advice',
  })
  @IsOptional()
  @IsString()
  dropoffInstructions?: string;

  @ApiPropertyOptional({
    description: 'Vehicle luxury amenities and features list',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiPropertyOptional({
    description: 'Structured features jsonb or dictionary',
  })
  @IsOptional()
  featuresJsonb?: any;
}

export class UpdateTransportationServiceDto extends PartialType(
  CreateTransportationServiceDto,
) {}

export class QueryTransportationServiceDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page limit', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Search term for name, type, or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by vehicle category (bus, coaster, private, transfer)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by service type (AIRPORT, HOTEL, CITY_TO_CITY)',
  })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (ALL, ACTIVE, INACTIVE, ARCHIVED)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Requested locale for translated content (en, ar, es, pt, it)',
  })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class UpdateTransportationBookingStatusDto {
  @ApiProperty({
    description: 'Updated booking status',
    enum: [
      'SUBMITTED',
      'UNDER_REVIEW',
      'QUOTED',
      'AWAITING_PAYMENT',
      'CONFIRMED',
      'ASSIGNED',
      'DRIVER_EN_ROUTE',
      'PASSENGER_PICKED_UP',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
      'REFUNDED',
    ],
  })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiPropertyOptional({ description: 'Assigned driver full name' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: 'Internal staff notes or instructions' })
  @IsOptional()
  @IsString()
  notes?: string;
}
