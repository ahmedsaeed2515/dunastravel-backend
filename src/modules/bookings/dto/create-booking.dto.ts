import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
  IsEmail,
  IsObject,
  IsIn,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Type of request: booking or inquiry' })
  @IsString()
  @IsNotEmpty()
  type!: 'booking' | 'inquiry';

  @ApiProperty({ description: 'Title of the tour to book (from frontend)' })
  @IsString()
  @IsOptional()
  tourTitle?: string;

  @ApiProperty({ description: 'ID of the tour' })
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiPropertyOptional({ description: 'ID of the availability/departure slot' })
  @IsOptional()
  @IsString()
  availabilityId?: string;

  @ApiPropertyOptional({ description: 'ID of departure slot' })
  @IsOptional()
  @IsString()
  departureId?: string;

  @ApiProperty({
    example: '2027-03-15',
    description: 'Arrival Date (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'arrivalDate must be in YYYY-MM-DD format',
  })
  arrivalDate!: string;

  @ApiPropertyOptional({
    example: '2027-03-22',
    description: 'Departure Date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'departureDate must be in YYYY-MM-DD format',
  })
  departureDate?: string;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional({ example: 'es' })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'], {
    message: 'language must be one of: en, ar, es, pt, it',
  })
  language?: string;

  @ApiPropertyOptional({ example: 'premium' })
  @IsOptional()
  @IsString()
  activityType?: string;

  @ApiPropertyOptional({ example: 'train' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  transportChoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  inquiryMessage?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  adults?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  children?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  infants?: number;

  @ApiPropertyOptional({
    description: 'Passenger names object e.g. { adult_0: "Name" }',
  })
  @IsOptional()
  @IsObject()
  passengerNames?: Record<string, string>;

  @ApiProperty({ description: 'Full Name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName!: string;

  @ApiProperty({ description: 'Email' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email!: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;

  @ApiPropertyOptional({ example: 'company' })
  @IsOptional()
  @IsString()
  invoiceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  country?: string;

  @ApiPropertyOptional({
    description: 'Optional promotion code to apply discount',
  })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Visitor analytics session ID' })
  @IsOptional()
  @IsString()
  analyticsSessionId?: string;

  @ApiPropertyOptional({ description: 'Origin landing page interface slug' })
  @IsOptional()
  @IsString()
  originInterfaceSlug?: string;
}
