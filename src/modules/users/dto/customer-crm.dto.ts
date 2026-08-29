import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;
const CRM_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'email',
  'customerNumber',
  'status',
  'isVip',
] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] as const;
const CUSTOMER_SOURCES = [
  'WEB',
  'ADMIN',
  'REFERRAL',
  'PHONE',
  'EMAIL',
  'PARTNER',
] as const;
const NOTE_TYPES = [
  'INTERNAL',
  'SALES',
  'OPERATIONS',
  'SUPPORT',
  'SECURITY',
] as const;
const DOCUMENT_TYPES = [
  'PASSPORT',
  'VISA',
  'INSURANCE',
  'TICKET',
  'IDENTITY',
  'OTHER',
] as const;

class AddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

class EmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;

  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone!: string;
}

class RelatedPersonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone?: string;
}

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search by name, email, phone, or customer number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by VIP status', example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by specific tag' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by customer segment' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  segment?: string;

  @ApiPropertyOptional({ enum: CRM_SORT_FIELDS, example: 'createdAt' })
  @IsOptional()
  @IsIn(CRM_SORT_FIELDS)
  sortBy?: (typeof CRM_SORT_FIELDS)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: SORT_ORDERS, example: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: (typeof SORT_ORDERS)[number] = 'desc';
}

export class UpdateCustomerCrmDto {
  @ApiPropertyOptional({ example: 'CUST-2026-0001' })
  @IsOptional()
  @IsString()
  @Matches(/^CUST-[A-Z0-9-]{4,40}$/)
  customerNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ example: ['HighValue', 'Repeat'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['VIP', 'Corporate'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  segments?: string[];

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];

  @ApiPropertyOptional({ example: 'P12345678' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{3,30}$/)
  passportNumber?: string;

  @ApiPropertyOptional({ example: 'Egyptian' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];

  @ApiPropertyOptional({ example: '1985-05-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateOfBirth?: string;

  @ApiPropertyOptional({ type: EmergencyContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  preferredCurrency?: string;

  @ApiPropertyOptional({ example: 'Sharm El Sheikh' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredDestination?: string;

  @ApiPropertyOptional({ example: 'Luxury Private' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredTravelType?: string;

  @ApiPropertyOptional({ type: [RelatedPersonDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RelatedPersonDto)
  familyMembers?: RelatedPersonDto[];

  @ApiPropertyOptional({ type: [RelatedPersonDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RelatedPersonDto)
  travelCompanions?: RelatedPersonDto[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ enum: CUSTOMER_SOURCES })
  @IsOptional()
  @IsIn(CUSTOMER_SOURCES)
  customerSource?: (typeof CUSTOMER_SOURCES)[number];

  @ApiPropertyOptional({ example: 'VIP Referral' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referralSource?: string;
}

export class BulkUpdateCustomersDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  userIds!: string[];

  @ApiPropertyOptional({ example: ['VIP', 'Summer2026'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  segments?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];
}

export class AddCustomerNoteDto {
  @ApiProperty({ example: 'Customer prefers suites with Nile view.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ enum: NOTE_TYPES, example: 'SALES' })
  @IsOptional()
  @IsIn(NOTE_TYPES)
  noteType?: (typeof NOTE_TYPES)[number];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class AddCustomerDocumentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  mediaAssetId!: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES, example: 'PASSPORT' })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: (typeof DOCUMENT_TYPES)[number];

  @ApiProperty({ example: 'Passport Scan 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;
}

export class CreateCustomerCrmDto {
  @ApiProperty({ example: 'Lady Eleanor Vance' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'eleanor.vance@luxurytravel.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ example: '+44 20 7946 0912' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'British' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredCurrency?: string;

  @ApiPropertyOptional({ example: 'Luxor & Aswan Nile Cruise' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredDestination?: string;

  @ApiPropertyOptional({ example: 'Luxury Private Dahabiya' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredTravelType?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_SOURCES, example: 'ADMIN' })
  @IsOptional()
  @IsIn(CUSTOMER_SOURCES)
  customerSource?: (typeof CUSTOMER_SOURCES)[number];

  @ApiPropertyOptional({ example: 'VIP referral from London concierge' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  initialNote?: string;

  @ApiPropertyOptional({ example: ['VIP', 'RepeatClient'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['LuxuryTraveler'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[];

  @ApiPropertyOptional({ example: 'GB987654321' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  passportNumber?: string;
}

