import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
  IsIn,
  Matches,
  Max,
  MaxLength,
  Min,
  IsUrl,
} from 'class-validator';

export class CreateTourLandingPageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsIn(['DESTINATION', 'THEME', 'COLLECTION'])
  type?: 'DESTINATION' | 'THEME' | 'COLLECTION';

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
  @Matches(/^(https:\/\/|\/)[^\s]+$/i, {
    message:
      'heroImageUrl must be an HTTPS URL or an absolute path starting with /',
  })
  @MaxLength(2048)
  heroImageUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(https:\/\/|\/)[^\s]+$/i, {
    message:
      'heroVideoUrl must be an HTTPS URL or an absolute path starting with /',
  })
  @MaxLength(2048)
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

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'INACTIVE'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'INACTIVE';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;
}
