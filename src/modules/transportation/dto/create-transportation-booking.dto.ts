import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransportationBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty()
  @IsDateString()
  pickupDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupTime?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pickupLocation!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dropoffLocation!: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(1)
  passengerCount!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  luggageCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flightNumber?: string;
}
