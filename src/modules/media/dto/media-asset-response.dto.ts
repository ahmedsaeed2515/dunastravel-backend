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
    return dto;
  }
}
