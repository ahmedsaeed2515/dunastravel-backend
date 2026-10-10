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

  @ApiPropertyOptional({ example: 'MANUAL' })
  @IsString()
  @IsOptional()
  sourceEntityType?: string;

  @ApiPropertyOptional({ example: 'visa_guidelines_2026' })
  @IsString()
  @IsOptional()
  sourceEntityId?: string;
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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceEntityType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceEntityId?: string;
}

export class CreateMultilingualKnowledgeDto {
  @ApiProperty({ example: 'معلومات عامة عن شركة دوناس ترافيل' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'تأسست شركة دوناس ترافيل كواحدة من رواد السياحة الفاخرة في مصر والشرق الأوسط...' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ example: 'ar' })
  @IsString()
  @IsOptional()
  sourceLocale?: string;

  @ApiPropertyOptional({ enum: KnowledgeCategoryEnum, example: KnowledgeCategoryEnum.COMPANY })
  @IsEnum(KnowledgeCategoryEnum)
  @IsOptional()
  category?: KnowledgeCategoryEnum;

  @ApiPropertyOptional({ example: ['company', 'about', 'dunas'] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  autoTranslate?: boolean;
}

export class CreateResponseRuleDto {
  @ApiProperty({ example: 'ما هي مواعيد العمل الرسمية؟' })
  @IsString()
  @IsNotEmpty()
  triggerQuestion!: string;

  @ApiProperty({ example: 'مواعيد العمل اليومية من الساعة 9 صباحاً حتى 6 مساءً بتوقيت القاهرة.' })
  @IsString()
  @IsNotEmpty()
  prescribedAnswer!: string;

  @ApiPropertyOptional({ example: 'FAQ' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'ar' })
  @IsString()
  @IsOptional()
  sourceLocale?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  autoTranslate?: boolean;

  @ApiPropertyOptional({ example: 40 })
  @IsNumber()
  @IsOptional()
  priority?: number;
}


