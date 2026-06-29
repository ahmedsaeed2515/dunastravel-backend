import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsNotEmpty, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTourItineraryDto {
  @ApiPropertyOptional({ description: 'Day label, e.g., Day 1: Arrival' })
  @IsOptional()
  @IsString()
  dayLabel?: string;

  @ApiProperty({ description: 'Multilingual description object' })
  @IsObject()
  @IsNotEmpty()
  descriptionJsonb!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual meals info' })
  @IsOptional()
  @IsObject()
  mealsJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual activities info' })
  @IsOptional()
  @IsObject()
  activitiesJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual hotel accommodations' })
  @IsOptional()
  @IsObject()
  hotelsJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual transportation info' })
  @IsOptional()
  @IsObject()
  transportationJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual internal/operational notes' })
  @IsOptional()
  @IsObject()
  notesJsonb?: Record<string, any>;

  @ApiProperty({ description: 'Display order' })
  @IsNumber()
  @Type(() => Number)
  sortOrder!: number;
}

export class CreateTourImageDto {
  @ApiProperty({ description: 'Image URL' })
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Is primary hero image', default: false })
  @IsOptional()
  @IsBoolean()
  isHero?: boolean;

  @ApiPropertyOptional({ description: 'Is video asset', default: false })
  @IsOptional()
  @IsBoolean()
  isVideo?: boolean;

  @ApiPropertyOptional({ description: 'Video URL if isVideo is true' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Alt text' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiProperty({ description: 'Display sort order' })
  @IsNumber()
  @Type(() => Number)
  sortOrder!: number;
}

export class CreateTourDto {
  @ApiProperty({ description: 'Unique URL slug' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ description: 'Multilingual title object' })
  @IsObject()
  @IsNotEmpty()
  titleJsonb!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Base price in USD' })
  @IsNumber()
  @Type(() => Number)
  basePriceUsd!: number;

  @ApiPropertyOptional({ description: 'Multilingual duration object' })
  @IsOptional()
  @IsObject()
  durationJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual overview object' })
  @IsOptional()
  @IsObject()
  overviewJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual minimum passenger info' })
  @IsOptional()
  @IsObject()
  minPaxJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is active flag', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Country name' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Region name' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Meeting point location' })
  @IsOptional()
  @IsString()
  meetingPoint?: string;

  @ApiPropertyOptional({ description: 'Departure time string' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional({ description: 'Return time string' })
  @IsOptional()
  @IsString()
  returnTime?: string;

  @ApiPropertyOptional({ description: 'Is featured flag', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Publishing status', default: 'PUBLISHED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'SEO Meta Title' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO Meta Description' })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ description: 'Multilingual included services' })
  @IsOptional()
  @IsObject()
  includedServicesJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual excluded services' })
  @IsOptional()
  @IsObject()
  excludedServicesJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual hotel information' })
  @IsOptional()
  @IsObject()
  hotelInfoJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual transportation information' })
  @IsOptional()
  @IsObject()
  transportationJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual pickup locations' })
  @IsOptional()
  @IsObject()
  pickupLocationsJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Supported languages array' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ description: 'Difficulty level' })
  @IsOptional()
  @IsString()
  difficultyLevel?: string;

  @ApiPropertyOptional({ description: 'Age restrictions description' })
  @IsOptional()
  @IsString()
  ageRestrictions?: string;

  @ApiPropertyOptional({ description: 'Multilingual cancellation policy' })
  @IsOptional()
  @IsObject()
  cancellationPolicyJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual terms and conditions' })
  @IsOptional()
  @IsObject()
  termsJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags array' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Maximum passenger capacity', default: 30 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Remaining available seats', default: 30 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  remainingSeats?: number;

  @ApiPropertyOptional({ description: 'Seasonal pricing and price rules JSONB' })
  @IsOptional()
  @IsObject()
  seasonPricingJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ type: [CreateTourItineraryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTourItineraryDto)
  itineraries?: CreateTourItineraryDto[];

  @ApiPropertyOptional({ type: [CreateTourImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTourImageDto)
  images?: CreateTourImageDto[];
}
