import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateBlogArticleDto {
  @ApiProperty({ description: 'Slug for the article' })
  @IsString()
  @IsNotEmpty()
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
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Author name' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Article category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Tags array' })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Publish status (DRAFT, PUBLISHED, ARCHIVED)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Whether the article is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Scheduled publish timestamp' })
  @IsOptional()
  @IsString()
  publishedAt?: string;
}
