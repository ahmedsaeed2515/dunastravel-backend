import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MediaEntityType } from '@prisma/client';

export class BulkMoveMediaDto {
  @ApiProperty({
    description: 'Array of media asset IDs to move',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  assetIds!: string[];

  @ApiProperty({
    enum: MediaEntityType,
    description: 'Target entity type (GENERAL, TOUR, HOTEL)',
  })
  @IsEnum(MediaEntityType)
  @IsNotEmpty()
  entityType!: MediaEntityType;

  @ApiPropertyOptional({
    description: 'Target entity ID (e.g. tour ID, hotel ID, or custom category slug)',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  entityId?: string | null;

  @ApiPropertyOptional({
    description: 'Target category slug',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;
}
