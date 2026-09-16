import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsObject } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ description: 'Visitor text message content', example: 'Recommend a 5-day Nile Cruise tour' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ description: 'Public session identifier', example: 'session-xyz-123' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiPropertyOptional({ description: 'Message locale', example: 'en' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ description: 'Client-generated idempotency key for deduplication' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Context of the page currently viewed by visitor' })
  @IsObject()
  @IsOptional()
  pageContext?: {
    tourSlug?: string;
    destinationSlug?: string;
    pathname?: string;
  };

  @ApiPropertyOptional({ description: 'Selected AI Concierge persona code (e.g. luxury_concierge, egyptologist, practical_budget, family_adventure, romantic_honeymoon)' })
  @IsString()
  @IsOptional()
  personaCode?: string;

  @ApiPropertyOptional({ description: 'Visitor voluntarily supplied contact information' })
  @IsObject()
  @IsOptional()
  visitorInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  };
}

export class BookTourChatDto {
  @ApiProperty({ description: 'Public session identifier' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ description: 'Tour ID or slug to book' })
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiProperty({ description: 'Arrival date (YYYY-MM-DD)', example: '2026-10-15' })
  @IsString()
  @IsNotEmpty()
  arrivalDate!: string;

  @ApiProperty({ description: 'Number of adult travelers', example: 2 })
  adults!: number;

  @ApiPropertyOptional({ description: 'Number of children (under 12)', example: 0 })
  @IsOptional()
  children?: number;

  @ApiPropertyOptional({ description: 'Number of infants', example: 0 })
  @IsOptional()
  infants?: number;

  @ApiProperty({ description: 'Lead traveler full name', example: 'Ahmed Saeed' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ description: 'Lead traveler email address', example: 'ahmed@example.com' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ description: 'Lead traveler phone / WhatsApp number', example: '+201012345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Nationality or country of residence', example: 'Egypt' })
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional({ description: 'Preferred transportation type', example: 'Private VIP Mercedes' })
  @IsString()
  @IsOptional()
  transportChoice?: string;

  @ApiPropertyOptional({ description: 'Special notes or dietary requirements' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Language / locale', example: 'ar' })
  @IsString()
  @IsOptional()
  locale?: string;
}

export class SubmitLeadDto {
  @ApiProperty({ description: 'Public session identifier' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ description: 'Visitor full name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Visitor email address' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ description: 'Visitor phone or WhatsApp number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Visitor country of residence or nationality' })
  @IsString()
  @IsOptional()
  nationality?: string;
}

export class HandoffRequestDto {
  @ApiProperty({ description: 'Public session identifier' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
