import {
  IsUrl,
  IsString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTourImageDto {
  @ApiProperty({ description: 'URL of the image' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @IsNotEmpty()
  @MaxLength(2_000)
  url!: string;

  @ApiProperty({ description: 'Public ID from Cloudinary or storage provider' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9/_-]+$/)
  publicId!: string;

  @ApiProperty({ description: 'Whether this is the hero image' })
  @IsBoolean()
  isHero!: boolean;

  @ApiProperty({ description: 'Sort order for display' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder!: number;
}
