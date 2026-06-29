import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class BulkUpdateBookingsDto {
  @ApiProperty({ description: 'Array of booking reference codes' })
  @IsArray()
  @IsString({ each: true })
  referenceCodes!: string[];

  @ApiPropertyOptional({
    description: 'New status for the bookings',
    enum: BookingStatus,
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'New assignee ID' })
  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'New priority' })
  @IsString()
  @IsOptional()
  priority?: string;
}
