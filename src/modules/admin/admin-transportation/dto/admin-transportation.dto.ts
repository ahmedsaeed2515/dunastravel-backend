import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TransportationBookingStatus } from '@prisma/client';

export class AdminTransportationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(TransportationBookingStatus)
  status?: TransportationBookingStatus;
}

export class UpdateTransportationStatusDto {
  @IsEnum(TransportationBookingStatus)
  status!: TransportationBookingStatus;
}

export class AssignTransportationDriverDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  driverName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleType?: string;
}

export class CreateTransportationServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  serviceType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  doors?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  transmission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  heroImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  pickupInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  dropoffInstructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  features?: string[];

  @IsOptional()
  @IsUUID()
  heroMediaId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePriceUsd!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTransportationServiceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  serviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  doors?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  transmission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  heroImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  pickupInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  dropoffInstructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  features?: string[];

  @IsOptional()
  @IsUUID()
  heroMediaId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePriceUsd?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
