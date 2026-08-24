import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HOTEL_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export class HotelRoomDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug!: string;

  @IsObject()
  @IsNotEmpty()
  nameJsonb!: Record<string, string>;

  @IsOptional()
  @IsObject()
  descriptionJsonb?: Record<string, string>;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ratePerNight!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsObject()
  mealPlanJsonb?: Record<string, string>;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxOccupancy!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inventory?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;
}

export class CreateHotelDto {
  @ApiProperty({ example: 'nile-palace-luxor' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug!: string;

  @ApiProperty({ example: { en: 'Nile Palace Luxor' } })
  @IsObject()
  @IsNotEmpty()
  nameJsonb!: Record<string, string>;

  @IsOptional()
  @IsObject()
  descriptionJsonb?: Record<string, string>;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  destinationSlug!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsObject()
  addressJsonb?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @IsObject()
  amenitiesJsonb?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  policiesJsonb?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  heroMediaId?: string;

  @IsOptional()
  @IsIn(HOTEL_STATUSES)
  status?: (typeof HOTEL_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HotelRoomDto)
  rooms?: HotelRoomDto[];
}

export class UpdateHotelDto extends PartialType(CreateHotelDto) {}
