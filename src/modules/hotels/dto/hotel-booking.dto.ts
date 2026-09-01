import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHotelBookingDto {
  @ApiPropertyOptional({ description: 'Hotel slug to book' })
  @IsOptional()
  @IsString()
  hotelSlug?: string;

  @ApiPropertyOptional({ description: 'Hotel ID' })
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ description: 'Room slug to book' })
  @IsOptional()
  @IsString()
  roomSlug?: string;

  @ApiPropertyOptional({ description: 'Room ID' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ description: 'Full name of guest' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  guestName!: string;

  @ApiProperty({ description: 'Email address of guest' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  guestEmail!: string;

  @ApiProperty({ description: 'Contact phone number with country code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  guestPhone!: string;

  @ApiProperty({ description: 'Check-in date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  checkInDate!: string;

  @ApiProperty({ description: 'Check-out date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  checkOutDate!: string;

  @ApiPropertyOptional({ description: 'Number of guests', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  guestsCount?: number;

  @ApiPropertyOptional({ description: 'Number of rooms', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  roomsCount?: number;

  @ApiPropertyOptional({ description: 'Special requests or preferences' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specialRequests?: string;
}

export class UpdateHotelBookingStatusDto {
  @ApiProperty({ description: 'Target booking status' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
  status!: string;

  @ApiPropertyOptional({ description: 'Admin operational notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class AdminHotelBookingsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by status (PENDING, CONFIRMED, CANCELLED, COMPLETED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by hotel ID' })
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ description: 'Search term by reference code, guest name, email or phone' })
  @IsOptional()
  @IsString()
  search?: string;
}
