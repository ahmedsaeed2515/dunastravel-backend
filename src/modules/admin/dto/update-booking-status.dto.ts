import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  @IsNotEmpty()
  status!: BookingStatus;

  @ApiProperty({
    required: false,
    description: 'Optional reason for cancellation or status change details.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
