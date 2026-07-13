/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
  IsEmail,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalculatePriceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class CreateBookingDto {
  @ApiProperty({ description: 'Type of request: booking or inquiry' })
  @IsString()
  @IsNotEmpty()
  type!: 'booking' | 'inquiry';

  @ApiProperty({ description: 'Title of the tour to book (from frontend)' })
  @IsString()
  @IsOptional()
  tourTitle?: string;

  @ApiProperty({ description: 'ID of the tour' })
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiPropertyOptional({ example: '2027-03-15', description: 'Arrival Date' })
  @IsOptional()
  @IsString()
  arrivalDate?: string;

  @ApiPropertyOptional({ example: '2027-03-22' })
  @IsOptional()
  @IsString()
  departureDate?: string;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 'premium' })
  @IsOptional()
  @IsString()
  activityType?: string;

  @ApiPropertyOptional({ example: 'train' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  transportChoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  inquiryMessage?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  adults?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  children?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  infants?: number;

  @ApiPropertyOptional({ description: 'Passenger names object e.g. { adult_0: "Name" }' })
  @IsOptional()
  @IsObject()
  passengerNames?: Record<string, string>;

  @ApiProperty({ description: 'Full Name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @ApiProperty({ description: 'Email' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email!: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;

  @ApiPropertyOptional({ example: 'company' })
  @IsOptional()
  @IsString()
  invoiceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  country?: string;

  @ApiPropertyOptional({ description: 'Optional promotion code to apply discount' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
