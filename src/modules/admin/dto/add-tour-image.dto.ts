import { IsUrl, IsString, IsBoolean, IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTourImageDto {
  @ApiProperty({ description: 'URL of the image' })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ description: 'Public ID from Cloudinary or storage provider' })
  @IsString()
  @IsNotEmpty()
  publicId!: string;

  @ApiProperty({ description: 'Whether this is the hero image' })
  @IsBoolean()
  isHero!: boolean;

  @ApiProperty({ description: 'Sort order for display' })
  @IsInt()
  sortOrder!: number;
}
