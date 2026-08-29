import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MediaEntityType } from '@prisma/client';

export class UploadMediaDto {
  @ApiProperty({
    enum: MediaEntityType,
    description: 'Type of entity this media belongs to',
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
    description: 'Accessibility alt text for the image',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    description: 'Category slug for general library assets',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;
}
