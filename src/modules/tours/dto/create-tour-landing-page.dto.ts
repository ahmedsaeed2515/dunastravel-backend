import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
} from 'class-validator';

export class CreateTourLandingPageDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsOptional()
  type?: string; // DESTINATION, THEME, COLLECTION

  @IsObject()
  @IsNotEmpty()
  titleJsonb!: Record<string, string>;

  @IsObject()
  @IsOptional()
  subtitleJsonb?: Record<string, string>;

  @IsObject()
  @IsOptional()
  descriptionJsonb?: Record<string, string>;

  @IsObject()
  @IsOptional()
  briefJsonb?: Record<string, string>;

  @IsString()
  @IsOptional()
  heroImageUrl?: string;

  @IsString()
  @IsOptional()
  heroVideoUrl?: string;

  @IsObject()
  @IsOptional()
  seoTitleJsonb?: Record<string, string>;

  @IsObject()
  @IsOptional()
  seoDescriptionJsonb?: Record<string, string>;

  @IsObject()
  @IsOptional()
  seoKeywordsJsonb?: Record<string, string>;

  @IsObject()
  @IsOptional()
  sectionsJsonb?: any;

  @IsString()
  @IsOptional()
  status?: string; // DRAFT, PUBLISHED, ARCHIVED, INACTIVE

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
