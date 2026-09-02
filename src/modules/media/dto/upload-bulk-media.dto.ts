import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { MediaEntityType } from '@prisma/client';

export class UploadBulkMediaDto {
  @ApiProperty({
    enum: MediaEntityType,
    description: 'Type of entity this media belongs to',
    default: MediaEntityType.GENERAL,
  })
  @IsEnum(MediaEntityType)
  @IsNotEmpty()
  entityType!: MediaEntityType;

  @ApiPropertyOptional({
    description: 'Required if entityType is TOUR or HOTEL, or category slug if GENERAL',
    type: 'string',
  })
  @ValidateIf(
    (o) =>
      o.entityType === MediaEntityType.TOUR ||
      o.entityType === MediaEntityType.HOTEL,
  )
  @IsNotEmpty()
  @IsString()
  entityId?: string | null;

  @ApiPropertyOptional({
    description: 'Optional category slug for general library assets',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    description: 'Optional default alt text or JSON string mapping filenames to alt text',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  altText?: string;
}
