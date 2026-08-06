import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsIn,
  IsISO8601,
  IsUrl,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateBlogArticleDto {
  @ApiProperty({ description: 'Slug for the article' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  slug!: string;

  @ApiProperty({ description: 'Localized title JSONB (en, ar, es, pt, it)' })
  @IsObject()
  titleJsonb!: Record<string, string>;

  @ApiProperty({ description: 'Localized content JSONB (en, ar, es, pt, it)' })
  @IsObject()
  contentJsonb!: Record<string, string>;

  @ApiPropertyOptional({ description: 'Localized excerpt JSONB' })
  @IsOptional()
  @IsObject()
  excerptJsonb?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Localized SEO Title JSONB' })
  @IsOptional()
  @IsObject()
  seoTitleJsonb?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Localized SEO Description JSONB' })
  @IsOptional()
  @IsObject()
  seoDescriptionJsonb?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Author name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;

  @ApiPropertyOptional({ description: 'Article category' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Tags array' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Publish status (DRAFT, PUBLISHED, ARCHIVED)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Whether the article is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Scheduled publish timestamp' })
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  publishedAt?: string;
}
