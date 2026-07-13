import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsEmail,
  IsArray,
  IsDateString,
  IsObject,
} from 'class-validator';
import { CompanyType, CompanyStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Luxury Travel' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: CompanyType, example: CompanyType.AGENCY })
  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @ApiPropertyOptional({ example: 'contact@acmetravel.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-0198' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acmetravel.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: { street: '123 Elite Ave', city: 'London' } })
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      name: 'John Doe',
      role: 'Director',
      email: 'john@acmetravel.com',
    },
  })
  @IsOptional()
  @IsObject()
  primaryContact?: Record<string, any>;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  commissionRate?: number;

  @ApiPropertyOptional({ example: 'NET_30' })
  @IsOptional()
  @IsString()
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
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate Partner'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[];
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Luxury Travel' })
  @IsOptional()
  @IsString()
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
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-0198' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acmetravel.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: { street: '123 Elite Ave', city: 'London' } })
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      name: 'John Doe',
      role: 'Director',
      email: 'john@acmetravel.com',
    },
  })
  @IsOptional()
  @IsObject()
  primaryContact?: Record<string, any>;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  commissionRate?: number;

  @ApiPropertyOptional({ example: 5000.0 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  currentBalance?: number;

  @ApiPropertyOptional({ example: 'NET_30' })
  @IsOptional()
  @IsString()
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
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate Partner'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[];
}

export class CompanyQueryFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class BulkUpdateCompaniesDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  companyIds!: string[];

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ example: ['VIP'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['Corporate Partner'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[];
}
