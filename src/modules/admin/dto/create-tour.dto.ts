import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsObject,
  IsIn,
  Min,
  Max,
  IsInt,
  ArrayMaxSize,
  MaxLength,
  IsDateString,
  Matches,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTourItineraryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  createdAt?: any;

  @ApiPropertyOptional()
  @IsOptional()
  updatedAt?: any;

  @ApiPropertyOptional({ description: 'Day label, e.g., Day 1: Arrival' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dayLabel?: string;

  @ApiPropertyOptional({ description: 'Multilingual title object' })
  @IsOptional()
  @IsObject()
  titleJsonb?: Record<string, any>;

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

  @ApiPropertyOptional({
    description: 'Multilingual internal/operational notes',
  })
  @IsOptional()
  @IsObject()
  notesJsonb?: Record<string, any>;

  @ApiProperty({ description: 'Display order' })
  @IsInt()
  @Min(0)
  @Max(1000)
  @Type(() => Number)
  sortOrder!: number;
}

export class CreateTourImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  createdAt?: any;

  @ApiPropertyOptional()
  @IsOptional()
  updatedAt?: any;

  @ApiProperty({ description: 'Image URL or path' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2048)
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
  @ValidateIf(
    (dto: CreateTourImageDto) =>
      Boolean(dto.videoUrl && String(dto.videoUrl).trim().length > 0),
  )
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Alt text' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiProperty({ description: 'Display sort order' })
  @IsInt()
  @Min(0)
  @Max(100_000)
  @Type(() => Number)
  sortOrder!: number;
}

export class SeasonPricingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  seasonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  seasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  seasonName?: string | Record<string, any>;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.5)
  @Max(5)
  multiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(99_999_999.99)
  priceUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(99_999_999.99)
  supplementUsd?: number;
}

export class TripAccommodationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: 'Assigned Hotel ID' })
  @IsOptional()
  @IsString()
  hotelId?: string | null;

  @ApiPropertyOptional({ description: 'Optional specific Room ID' })
  @IsOptional()
  @IsString()
  roomId?: string | null;

  @ApiPropertyOptional({ description: 'Destination or city label (e.g. Cairo, Luxor)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  destination?: string | null;

  @ApiPropertyOptional({ description: 'City label alias (e.g. Cairo, Luxor)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ description: 'Category tier (e.g. Standard, Deluxe, Luxury)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryTier?: string | null;

  @ApiPropertyOptional({ description: 'Number of nights at this hotel', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  nights?: number;

  @ApiPropertyOptional({ description: 'Start day of the tour (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  dayFrom?: number | null;

  @ApiPropertyOptional({ description: 'End day of the tour (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  dayTo?: number | null;

  @ApiPropertyOptional({ description: 'Price supplement in USD', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999.99)
  priceSupplementUsd?: number;

  @ApiPropertyOptional({ description: 'Is default hotel choice for this city/tier', default: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Multilingual notes for this accommodation' })
  @IsOptional()
  @IsObject()
  notesJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpsertTourAccommodationsDto {
  @ApiProperty({ type: [TripAccommodationDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TripAccommodationDto)
  accommodations!: TripAccommodationDto[];
}

export class CreateTourDto {
  @ApiProperty({ description: 'Unique URL slug' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty({ description: 'Multilingual title object' })
  @IsObject()
  @IsNotEmpty()
  titleJsonb!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiProperty({ description: 'Base price in USD (or base currency equivalent)' })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  @Type(() => Number)
  basePriceUsd!: number;

  @ApiPropertyOptional({ description: 'Authoritative original price in specified currency' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  @Type(() => Number)
  originalPrice?: number;

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
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'City name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Region name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional({ description: 'Meeting point location' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingPoint?: string;

  @ApiPropertyOptional({ description: 'Departure time string' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  departureTime?: string;

  @ApiPropertyOptional({ description: 'Return time string' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  returnTime?: string;

  @ApiPropertyOptional({ description: 'Is featured flag', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Publishing status',
    default: 'DRAFT',
  })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional({ description: 'SEO Meta Title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO Meta Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
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

  @ApiPropertyOptional({
    description: 'Multilingual transportation information',
  })
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
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  languages?: string[];

  @ApiPropertyOptional({ description: 'Difficulty level' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  difficultyLevel?: string;

  @ApiPropertyOptional({ description: 'Age restrictions description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Seasonal pricing and price rules JSONB (array of rules or { rules: [...] })',
  })
  @IsOptional()
  seasonPricingJsonb?: SeasonPricingRuleDto[] | Record<string, any> | null;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD', enum: ['USD', 'EUR'] })
  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR'])
  currency?: string;

  @ApiPropertyOptional({ description: 'Capacity or max seats' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Min participants' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minParticipants?: number;

  @ApiPropertyOptional({ description: 'Max participants' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Remaining seats' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  remainingSeats?: number;

  @ApiPropertyOptional({ description: 'Subtitle JSONB' })
  @IsOptional()
  @IsObject()
  subtitleJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual tour highlights' })
  @IsOptional()
  @IsObject()
  highlightsJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual departure information' })
  @IsOptional()
  @IsObject()
  departureInfoJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Multilingual source program code' })
  @IsOptional()
  @IsObject()
  sourceCodeJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Interactive Journey Route Map JSONB' })
  @IsOptional()
  @IsObject()
  routeMapJsonb?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'How the tour price is displayed on the public site',
    enum: ['PRICE', 'HIDDEN', 'CUSTOM_LABEL'],
    default: 'PRICE',
  })
  @IsOptional()
  @IsString()
  @IsIn(['PRICE', 'HIDDEN', 'CUSTOM_LABEL'])
  priceDisplayMode?: string;

  @ApiPropertyOptional({
    description:
      'Multilingual custom price label (used when priceDisplayMode = CUSTOM_LABEL)',
  })
  @IsOptional()
  @IsObject()
  priceLabelJsonb?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Recurring booking rules: daily cutoff time, blocked weekdays, blocked date ranges',
  })
  @IsOptional()
  @IsObject()
  bookingRulesJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Source market label' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  market?: string;

  @ApiPropertyOptional({ description: 'Published source rating' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  @Type(() => Number)
  sourceRating?: number;

  @ApiPropertyOptional({ description: 'Published source review count' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sourceReviewCount?: number;

  @ApiPropertyOptional({ description: 'Description JSONB' })
  @IsOptional()
  @IsObject()
  descriptionJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Highlight JSONB' })
  @IsOptional()
  @IsObject()
  highlightJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Inclusion JSONB' })
  @IsOptional()
  @IsObject()
  inclusionJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Exclusion JSONB' })
  @IsOptional()
  @IsObject()
  exclusionJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Important Notes JSONB' })
  @IsOptional()
  @IsObject()
  importantNotesJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Operating Days JSONB' })
  @IsOptional()
  @IsObject()
  operatingDaysJsonb?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Display priority order — lower value = appears first (0 = default)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;

  @ApiPropertyOptional({ type: [CreateTourItineraryDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateTourItineraryDto)
  itineraries?: CreateTourItineraryDto[];

  @ApiPropertyOptional({ type: [CreateTourImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateTourImageDto)
  images?: CreateTourImageDto[];

  @ApiPropertyOptional({ type: [TripAccommodationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TripAccommodationDto)
  accommodations?: TripAccommodationDto[];
}
