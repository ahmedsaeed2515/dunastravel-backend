import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsInt,
  IsUUID,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalculatePriceDto {
  @ApiProperty({ description: 'ID or slug of the tour' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'tourId must be a valid alphanumeric identifier, UUID, or slug',
  })
  tourId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  availabilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departureId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  adults!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  children?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  infants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  promoCode?: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  language?: string;
}
