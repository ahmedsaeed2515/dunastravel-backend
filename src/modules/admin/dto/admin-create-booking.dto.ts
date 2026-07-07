import { IsString, IsInt, Min, IsOptional, IsNumber, IsEnum, IsUUID } from 'class-validator';
import { BookingStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCreateBookingDto {
  @ApiProperty({ description: 'ID of the tour' })
  @IsString()
  tourId!: string;

  @ApiProperty({ description: 'ID or email of the user' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Number of passengers' })
  @IsInt()
  @Min(1)
  passengers!: number;

  @ApiPropertyOptional({ description: 'Manual override for total amount' })
  @IsOptional()
  @IsNumber()
  manualAmountUsd?: number;

  @ApiPropertyOptional({ description: 'Initial status of the booking', enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
