import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateTransportPricingDto {
  @ApiPropertyOptional({ description: 'Tour ID or null for booking-level pricing' })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({ description: 'Booking ID or null for tour-level pricing' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ description: 'Category of transportation (e.g., transfer, transportation)' })
  @IsString()
  category!: string;

  @ApiProperty({ description: 'Passenger range (e.g., "2-4", "5-7", "8-14")' })
  @IsString()
  passengerRange!: string;

  @ApiProperty({ description: 'Price in USD' })
  @IsNumber()
  priceUsd!: number;

  @ApiPropertyOptional({ description: 'Currency (default: USD)' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateTransportPricingDto {
  @ApiPropertyOptional({ description: 'Price in USD' })
  @IsOptional()
  @IsNumber()
  priceUsd?: number;

  @ApiPropertyOptional({ description: 'Currency' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Whether this pricing is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransportPricingResponse {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  tourId?: string;

  @ApiPropertyOptional()
  bookingId?: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  passengerRange!: string;

  @ApiProperty()
  priceUsd!: number;

  @ApiPropertyOptional()
  currency?: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
