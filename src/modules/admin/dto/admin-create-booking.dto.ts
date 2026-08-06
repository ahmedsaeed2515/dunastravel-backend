import {
  IsString,
  IsInt,
  Min,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEmail,
  IsNotEmpty,
  Matches,
  IsUUID,
  IsIn,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCreatePassengerDto {
  @ApiProperty({ description: 'Full name of the passenger' })
  @IsString()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ description: 'Type of passenger (e.g. ADULT, CHILD, INFANT)' })
  @IsIn(['ADULT', 'CHILD', 'INFANT'])
  passengerType!: string;

  @ApiPropertyOptional({ description: 'Passport number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{2,29}$/)
  passportNumber?: string;

  @ApiPropertyOptional({ description: 'Nationality' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;
}

export class AdminCreateBookingDto {
  @ApiProperty({ description: 'ID of the tour' })
  @IsUUID('4')
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
  @MaxLength(30)
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone!: string;

  @ApiPropertyOptional({
    description: 'Number of adult passengers',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  adults?: number;

  @ApiPropertyOptional({
    description: 'Number of child passengers',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  children?: number;

  @ApiPropertyOptional({
    description: 'Number of infant passengers',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
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
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ description: 'Availability slot ID' })
  @IsOptional()
  @IsUUID('4')
  availabilityId?: string;

  @ApiPropertyOptional({ description: 'Invoice type (PERSONAL or COMPANY)' })
  @IsOptional()
  @IsIn(['PERSONAL', 'COMPANY'])
  invoiceType?: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({ description: 'Billing address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'Billing city' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Billing country' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'Promo code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/)
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Internal booking notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'List of passengers',
    type: [AdminCreatePassengerDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdminCreatePassengerDto)
  passengers?: AdminCreatePassengerDto[];

}
