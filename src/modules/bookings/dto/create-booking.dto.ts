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
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Type of request: booking or inquiry' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['booking', 'inquiry'])
  type!: 'booking' | 'inquiry';

  @ApiProperty({ description: 'Title of the tour to book (from frontend)' })
  @IsString()
  @IsOptional()
  tourTitle?: string;

  @ApiProperty({ description: 'ID or slug of the tour' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'tourId must be a valid alphanumeric identifier, UUID, or slug',
  })
  tourId!: string;

  @ApiPropertyOptional({ description: 'ID of the availability/departure slot' })
  @IsOptional()
  @IsUUID()
  availabilityId?: string;

  @ApiPropertyOptional({ description: 'ID of departure slot' })
  @IsOptional()
  @IsUUID()
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
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  arrivalTime?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
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
  @MaxLength(50)
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
  @MaxLength(254)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email!: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[\d\s\-+()]+$/)
  phone!: string;

  @ApiPropertyOptional({ example: 'PERSONAL', enum: ['PERSONAL', 'COMPANY'] })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @IsIn(['PERSONAL', 'COMPANY'])
  invoiceType?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateBookingDto) => o.invoiceType === 'COMPANY')
  @IsNotEmpty({ message: 'companyName is required when invoiceType is COMPANY' })
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
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Visitor analytics session ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  analyticsSessionId?: string;

  @ApiPropertyOptional({ description: 'Origin landing page interface slug' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  originInterfaceSlug?: string;
}
