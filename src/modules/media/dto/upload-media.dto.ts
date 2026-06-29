import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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
    description: 'Required if entityType is TOUR',
    type: 'string',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  @ValidateIf((o) => o.entityType === MediaEntityType.TOUR)
  @IsNotEmpty()
  entityId!: string | null;

  @ApiPropertyOptional({
    description: 'Accessibility alt text for the image',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText!: string | null;
}
