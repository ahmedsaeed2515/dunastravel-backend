import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsArray,
  ArrayMaxSize,
  IsIn,
  MaxLength,
} from 'class-validator';

export class UpdateBookingDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  transportChoice?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(5_000)
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(2_000)
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
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Priority level' })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;
}
