import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsIn, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ShowcasePhotoItemDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiPropertyOptional()
  alt?: string | null;

  @ApiProperty()
  url!: string;

  @ApiPropertyOptional()
  optimizedUrl?: string | null;

  @ApiPropertyOptional()
  thumbnailUrl?: string | null;

  @ApiProperty()
  position!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  width?: number | null;

  @ApiPropertyOptional()
  height?: number | null;

  @ApiPropertyOptional()
  category?: string | null;
}

export class ShowcaseVideoItemDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiPropertyOptional()
  alt?: string | null;

  @ApiProperty()
  url!: string;

  @ApiPropertyOptional()
  videoUrl?: string | null;

  @ApiPropertyOptional()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional()
  posterUrl?: string | null;

  @ApiPropertyOptional()
  duration?: number | null;

  @ApiProperty()
  position!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  width?: number | null;

  @ApiPropertyOptional()
  height?: number | null;
}

export class HomepageMediaShowcaseResponseDto {
  @ApiProperty({ type: [ShowcasePhotoItemDto] })
  photos!: ShowcasePhotoItemDto[];

  @ApiProperty({ type: [ShowcaseVideoItemDto] })
  videos!: ShowcaseVideoItemDto[];
}

export class AssignToShowcaseDto {
  @ApiProperty({ description: 'UUID of the media asset to assign' })
  @IsUUID()
  assetId!: string;

  @ApiProperty({ enum: ['PHOTO', 'VIDEO'], default: 'PHOTO' })
  @IsIn(['PHOTO', 'VIDEO'])
  section!: 'PHOTO' | 'VIDEO';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;
}

export class UpdateShowcaseItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsNumber()
  position!: number;
}

export class ReorderShowcaseDto {
  @ApiProperty({ enum: ['PHOTO', 'VIDEO'] })
  @IsIn(['PHOTO', 'VIDEO'])
  section!: 'PHOTO' | 'VIDEO';

  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

export class OptimizeAssetDto {
  @ApiPropertyOptional({ default: 'webp' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ default: 'auto:good' })
  @IsOptional()
  @IsString()
  quality?: string;

  @ApiPropertyOptional({ default: 1920 })
  @IsOptional()
  @IsNumber()
  maxWidth?: number;

  @ApiPropertyOptional({ default: 1080 })
  @IsOptional()
  @IsNumber()
  maxHeight?: number;
}
