import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaEntityType } from '@prisma/client';

export class MediaUrlItemDto {
  @ApiProperty({ description: 'Direct image URL' })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({ description: 'Accessibility alt text for this specific image' })
  @IsOptional()
  @IsString()
  altText?: string;
}

export class ImportMediaUrlsDto {
  @ApiProperty({
    type: [MediaUrlItemDto],
    description: 'Array of image URLs to import with optional individual alt text',
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MediaUrlItemDto)
  items!: MediaUrlItemDto[];

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
    description: 'Default alt text applied if individual altText is not provided',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  defaultAltText?: string;
}
