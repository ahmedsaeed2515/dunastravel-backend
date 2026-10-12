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
const BOARD_BASIS_OPTIONS = ['RO', 'BB', 'HB', 'FB', 'AI'] as const;

export class RoomSeasonPricingDto {
  @IsString()
  @IsNotEmpty()
  seasonId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ratePerNight!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  singleSupplement?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  childRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraBedRate?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(BOARD_BASIS_OPTIONS)
  boardBasis?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSeasonDto {
  @ApiProperty({ example: 'WINTER_PEAK_2026' })
  @IsString()
  @Matches(/^[A-Z0-9_\\-]+$/i)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: { en: 'Winter Peak Season', ar: 'موسم ذروة الشتاء' } })
  @IsObject()
  @IsNotEmpty()
  nameJsonb!: Record<string, string>;

  @ApiProperty({ example: '2026-11-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiProperty({ example: '2027-03-31' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(5)
  multiplier?: number;

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

export class UpdateSeasonDto extends PartialType(CreateSeasonDto) {}

export class HotelRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug!: string;

  @IsObject()
  @IsNotEmpty()
  nameJsonb!: Record<string, string>;

  @IsOptional()
  @IsObject()
  descriptionJsonb?: Record<string, unknown>;

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

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsObject()
  amenitiesJsonb?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RoomSeasonPricingDto)
  seasonPricings?: RoomSeasonPricingDto[];
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
  @MaxLength(100)
  heroMediaId?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsArray()
  images?: Array<{ id?: string; url: string; altText?: string; isHero?: boolean; sortOrder?: number }>;

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
  @IsBoolean()
  isGlobal?: boolean;

  @IsOptional()
  @IsString()
  tourId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HotelRoomDto)
  rooms?: HotelRoomDto[];
}

export class UpdateHotelDto extends PartialType(CreateHotelDto) {}

export class UpsertTripHotelDto extends PartialType(CreateHotelDto) {
  @ApiPropertyOptional({ example: 'trip-luxury-nile-adventure-hotel' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ example: 'cairo' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  destinationSlug?: string;
}
