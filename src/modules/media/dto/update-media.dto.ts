import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MediaEntityType } from '@prisma/client';

export class UpdateMediaDto {
  @ApiPropertyOptional({
    description: 'Accessibility alt text or caption for the image',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    enum: MediaEntityType,
    description: 'Type of entity/category this media belongs to',
  })
  @IsOptional()
  @IsEnum(MediaEntityType)
  entityType?: MediaEntityType;

  @ApiPropertyOptional({
    description: 'Target category slug, folder, tour ID, or hotel ID',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  entityId?: string | null;

  @ApiPropertyOptional({
    description:
      'Category slug or folder name (e.g. destinations, banners, blog)',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
