import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePriceUsd?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
