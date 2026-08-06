import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, Min } from 'class-validator';

export enum KnowledgeCategoryEnum {
  COMPANY = 'COMPANY',
  FAQ = 'FAQ',
  BOOKING_POLICY = 'BOOKING_POLICY',
  CANCELLATION_POLICY = 'CANCELLATION_POLICY',
  PAYMENT_INFO = 'PAYMENT_INFO',
  VISA_GUIDANCE = 'VISA_GUIDANCE',
  DESTINATION_INFO = 'DESTINATION_INFO',
  SAFETY_ADVICE = 'SAFETY_ADVICE',
  TRANSPORTATION = 'TRANSPORTATION',
  HOTELS = 'HOTELS',
  CUSTOM_TOURS = 'CUSTOM_TOURS',
  INCLUSIONS_EXCLUSIONS = 'INCLUSIONS_EXCLUSIONS',
  CONTACT_SUPPORT = 'CONTACT_SUPPORT',
  GENERAL = 'GENERAL',
}

export enum KnowledgeStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export class CreateKnowledgeItemDto {
  @ApiProperty({ example: 'Cairo & Nile Cruise Booking Policy' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Full payment is required 14 days before arrival...' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ enum: KnowledgeCategoryEnum, example: KnowledgeCategoryEnum.BOOKING_POLICY })
  @IsEnum(KnowledgeCategoryEnum)
  @IsOptional()
  category?: KnowledgeCategoryEnum;

  @ApiPropertyOptional({ example: ['cairo', 'nile cruise', 'booking'] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ enum: KnowledgeStatusEnum, example: KnowledgeStatusEnum.PUBLISHED })
  @IsEnum(KnowledgeStatusEnum)
  @IsOptional()
  status?: KnowledgeStatusEnum;

  @ApiPropertyOptional({ example: 'Official Terms Document v2' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;
}

export class UpdateKnowledgeItemDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ enum: KnowledgeCategoryEnum })
  @IsEnum(KnowledgeCategoryEnum)
  @IsOptional()
  category?: KnowledgeCategoryEnum;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ enum: KnowledgeStatusEnum })
  @IsEnum(KnowledgeStatusEnum)
  @IsOptional()
  status?: KnowledgeStatusEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;
}
