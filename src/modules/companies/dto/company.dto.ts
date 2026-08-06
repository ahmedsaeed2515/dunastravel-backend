import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsEmail,
  IsArray,
  IsDateString,
  Max,
  Min,
  MaxLength,
  IsUrl,
  ArrayMaxSize,
  IsInt,
  IsUUID,
  IsIn,
  ValidateNested,
  IsNotEmpty,
  Matches,
  ArrayMinSize,
} from 'class-validator';
import { CompanyType, CompanyStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

class CompanyAddressDto {
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

class PrimaryContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone?: string;
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Luxury Travel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ enum: CompanyType, example: CompanyType.AGENCY })
  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @ApiPropertyOptional({ example: 'contact@acmetravel.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-0198' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acmetravel.com' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9./ -]{2,100}$/)
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({ example: { street: '123 Elite Ave', city: 'London' } })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyAddressDto)
  address?: CompanyAddressDto;

  @ApiPropertyOptional({
    example: {
      name: 'John Doe',
      role: 'Director',
      email: 'john@acmetravel.com',
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PrimaryContactDto)
  primaryContact?: PrimaryContactDto;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  @Type(() => Number)
  commissionRate?: number;

  @ApiPropertyOptional({ example: 'NET_30' })
  @IsOptional()
  @IsString()
  @IsIn(['PREPAID', 'NET_7', 'NET_15', 'NET_30', 'NET_45', 'NET_60'])
  paymentTerms?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: ['VIP', 'Europe'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate Partner'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  segments?: string[];
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Luxury Travel' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: CompanyType, example: CompanyType.AGENCY })
  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @ApiPropertyOptional({ enum: CompanyStatus, example: CompanyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ example: 'contact@acmetravel.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-0198' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acmetravel.com' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9./ -]{2,100}$/)
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({ example: { street: '123 Elite Ave', city: 'London' } })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyAddressDto)
  address?: CompanyAddressDto;

  @ApiPropertyOptional({
    example: {
      name: 'John Doe',
      role: 'Director',
      email: 'john@acmetravel.com',
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PrimaryContactDto)
  primaryContact?: PrimaryContactDto;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  @Type(() => Number)
  commissionRate?: number;

  @ApiPropertyOptional({ example: 'NET_30' })
  @IsOptional()
  @IsString()
  @IsIn(['PREPAID', 'NET_7', 'NET_15', 'NET_30', 'NET_45', 'NET_60'])
  paymentTerms?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: ['VIP', 'Europe'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate Partner'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  segments?: string[];
}

export class CompanyQueryFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CompanyType })
  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  segment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'referenceCode', 'currentBalance'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'referenceCode' | 'currentBalance';

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class BulkUpdateCompaniesDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  companyIds!: string[];

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ example: ['VIP'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate Partner'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  segments?: string[];
}
