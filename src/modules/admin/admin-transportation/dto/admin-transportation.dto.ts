import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
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
