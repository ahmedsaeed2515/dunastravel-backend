import {
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsArray,
  IsEmail,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BookingStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCreatePassengerDto {
  @ApiProperty({ description: 'Full name of the passenger' })
  @IsString()
  fullName!: string;

  @ApiProperty({ description: 'Type of passenger (e.g. ADULT, CHILD, INFANT)' })
  @IsString()
  passengerType!: string;

  @ApiPropertyOptional({ description: 'Passport number' })
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional({ description: 'Nationality' })
  @IsOptional()
  @IsString()
  nationality?: string;
}

export class AdminCreateBookingDto {
  @ApiProperty({ description: 'ID of the tour' })
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiProperty({ description: 'Arrival date in YYYY-MM-DD format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'arrivalDate must be in YYYY-MM-DD format',
  })
  arrivalDate!: string;

  @ApiProperty({ description: 'Full Name of primary customer' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName!: string;

  @ApiProperty({ description: 'Email address of primary customer' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email!: string;

  @ApiProperty({ description: 'Phone number of primary customer' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({
    description: 'Number of adult passengers',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({
    description: 'Number of child passengers',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({
    description: 'Number of infant passengers',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  infants?: number;

  @ApiPropertyOptional({ description: 'Departure date in YYYY-MM-DD format' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'departureDate must be in YYYY-MM-DD format',
  })
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Optional User ID if customer exists' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Availability slot ID' })
  @IsOptional()
  @IsString()
  availabilityId?: string;

  @ApiPropertyOptional({ description: 'Invoice type (PERSONAL or COMPANY)' })
  @IsOptional()
  @IsString()
  invoiceType?: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Billing address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Billing city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Billing country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Promo code' })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Internal booking notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'List of passengers',
    type: [AdminCreatePassengerDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCreatePassengerDto)
  passengers?: AdminCreatePassengerDto[];

  @ApiPropertyOptional({
    description: 'Initial status of the booking',
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
