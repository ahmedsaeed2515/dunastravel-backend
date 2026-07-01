import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  Min,
  IsEnum,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search by name, email, phone, or passport',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by VIP status', example: 'true' })
  @IsOptional()
  @IsString()
  isVip?: string;

  @ApiPropertyOptional({
    description: 'Filter by account status (e.g. ACTIVE, INACTIVE, BLOCKED)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by specific tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by customer segment' })
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional({ example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: string;
}

export class UpdateCustomerCrmDto {
  @ApiPropertyOptional({ example: 'CUST-2026-0001' })
  @IsOptional()
  @IsString()
  customerNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ example: ['HighValue', 'Repeat'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['VIP', 'Corporate'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[];

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'P12345678' })
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional({ example: 'Egyptian' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: 'Male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '1985-05-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: {
      name: 'Sarah Connor',
      relationship: 'Spouse',
      phone: '+123456789',
    },
  })
  @IsOptional()
  @IsObject()
  emergencyContact?: Record<string, any>;

  @ApiPropertyOptional({
    example: { street: '123 Nile Ave', city: 'Cairo', country: 'Egypt' },
  })
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  preferredCurrency?: string;

  @ApiPropertyOptional({ example: 'Sharm El Sheikh' })
  @IsOptional()
  @IsString()
  preferredDestination?: string;

  @ApiPropertyOptional({ example: 'Luxury Private' })
  @IsOptional()
  @IsString()
  preferredTravelType?: string;

  @ApiPropertyOptional({
    example: [{ name: 'John Jr', relationship: 'Son', age: 10 }],
  })
  @IsOptional()
  @IsArray()
  familyMembers?: any[];

  @ApiPropertyOptional({ example: [{ name: 'Alice', relationship: 'Friend' }] })
  @IsOptional()
  @IsArray()
  travelCompanions?: any[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;

  @ApiPropertyOptional({ example: 'WEB' })
  @IsOptional()
  @IsString()
  customerSource?: string;

  @ApiPropertyOptional({ example: 'VIP Referral' })
  @IsOptional()
  @IsString()
  referralSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  futureCompanyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  futureWalletId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  futureCommissionPlan?: string;
}

export class BulkUpdateCustomersDto {
  @ApiPropertyOptional({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @ApiPropertyOptional({ example: ['VIP', 'Summer2026'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ example: 'INACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class AddCustomerNoteDto {
  @ApiPropertyOptional({ example: 'Customer prefers suites with Nile view.' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ example: 'SALES' })
  @IsOptional()
  @IsString()
  noteType?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class AddCustomerDocumentDto {
  @ApiPropertyOptional({ example: 'media-uuid-1' })
  @IsString()
  mediaAssetId!: string;

  @ApiPropertyOptional({ example: 'PASSPORT' })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({ example: 'Passport Scan 2026' })
  @IsString()
  title!: string;
}
