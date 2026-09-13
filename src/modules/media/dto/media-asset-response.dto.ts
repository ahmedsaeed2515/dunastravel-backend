import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaAsset } from '@prisma/client';
import { IMediaAsset } from '../interfaces/media-asset.interface';

export class MediaAssetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  publicId!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  secureUrl!: string;

  @ApiProperty()
  providerName!: string;

  @ApiProperty()
  format!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  bytes!: number;

  @ApiPropertyOptional()
  width!: number | null;

  @ApiPropertyOptional()
  height!: number | null;

  @ApiProperty()
  entityType!: string;

  @ApiPropertyOptional()
  entityId!: string | null;

  @ApiProperty()
  provenance!: string;

  @ApiPropertyOptional()
  altText!: string | null;

  @ApiPropertyOptional()
  uploadedBy!: string | null;

  @ApiPropertyOptional()
  deletedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ default: 'IMAGE' })
  mediaType!: string;

  @ApiProperty({ default: 'image' })
  cloudinaryResourceType!: string;

  @ApiPropertyOptional()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional()
  optimizedUrl?: string | null;

  @ApiPropertyOptional()
  duration?: number | null;

  @ApiProperty({ default: false })
  isShowcase!: boolean;

  @ApiPropertyOptional()
  showcaseSection?: string | null;

  @ApiPropertyOptional()
  showcasePosition?: number | null;

  @ApiProperty({ default: true })
  isActive!: boolean;

  @ApiProperty({ default: true })
  isPublished!: boolean;

  @ApiPropertyOptional()
  metadata?: any;

  static fromPrisma(asset: IMediaAsset | MediaAsset): MediaAssetResponseDto {
    const dto = new MediaAssetResponseDto();
    dto.id = asset.id;
    dto.publicId = asset.publicId;
    dto.url = asset.url;
    dto.secureUrl = asset.secureUrl;
    dto.providerName = asset.providerName;
    dto.format = asset.format;
    dto.mimeType = asset.mimeType;
    dto.bytes = asset.bytes;
    dto.width = asset.width;
    dto.height = asset.height;
    dto.entityType = asset.entityType;
    dto.entityId = asset.entityId;
    dto.provenance = asset.provenance;
    dto.altText = asset.altText;
    dto.uploadedBy = asset.uploadedBy;
    dto.deletedAt = asset.deletedAt;
    dto.createdAt = asset.createdAt;
    dto.updatedAt = asset.updatedAt;
    dto.title = asset.title ?? null;
    dto.description = asset.description ?? null;
    dto.mediaType = asset.mediaType ?? 'IMAGE';
    dto.cloudinaryResourceType = asset.cloudinaryResourceType ?? 'image';
    dto.thumbnailUrl = asset.thumbnailUrl ?? null;
    dto.optimizedUrl = asset.optimizedUrl ?? null;
    dto.duration = asset.duration ?? null;
    dto.isShowcase = asset.isShowcase ?? false;
    dto.showcaseSection = asset.showcaseSection ?? null;
    dto.showcasePosition = asset.showcasePosition ?? null;
    dto.isActive = asset.isActive ?? true;
    dto.isPublished = asset.isPublished ?? true;
    dto.metadata = asset.metadata ?? null;
    return dto;
  }
}
