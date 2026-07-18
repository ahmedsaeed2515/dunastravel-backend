import {
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCreatePassengerDto {
  @ApiProperty({ description: 'Full name of the passenger' })
  @IsString()
  fullName!: string;

  @ApiProperty({ description: 'Type of passenger (e.g. ADULT, CHILD, INFANT)' })
  @IsString()
  passengerType!: string;
}

export class AdminCreateBookingDto {
  @ApiProperty({ description: 'ID of the tour' })
  @IsString()
  tourId!: string;

  @ApiProperty({ description: 'ID or email of the user' })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'List of passengers',
    type: [AdminCreatePassengerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCreatePassengerDto)
  passengers!: AdminCreatePassengerDto[];

  @ApiPropertyOptional({ description: 'Manual override for total amount' })
  @IsOptional()
  @IsNumber()
  manualAmountUsd?: number;

  @ApiPropertyOptional({
    description: 'Initial status of the booking',
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
