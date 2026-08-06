import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IMediaAsset } from '../interfaces/media-asset.interface';

export class PublicMediaAssetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  secureUrl!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiPropertyOptional()
  width!: number | null;

  @ApiPropertyOptional()
  height!: number | null;

  @ApiPropertyOptional()
  altText!: string | null;

  static fromPrisma(asset: IMediaAsset): PublicMediaAssetResponseDto {
    return {
      id: asset.id,
      secureUrl: asset.secureUrl,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      altText: asset.altText,
    };
  }
}
