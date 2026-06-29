import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from 'class-validator';

export class UpdateBookingDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  transportChoice?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  arrivalDate?: string;

  @ApiPropertyOptional({ description: 'Departure date' })
  @IsDateString()
  @IsOptional()
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Tags for the booking' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Priority level' })
  @IsString()
  @IsOptional()
  priority?: string;
}
