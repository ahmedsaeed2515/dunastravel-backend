import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalculatePriceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  availabilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departureId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(1)
  adults!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  infants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  language?: string;
}
