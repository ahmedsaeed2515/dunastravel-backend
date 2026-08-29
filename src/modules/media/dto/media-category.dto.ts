import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMediaCategoryDto {
  @ApiProperty({ description: 'Category name in English', example: 'Destinations & Landmarks' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameEn!: string;

  @ApiProperty({ description: 'Category name in Arabic', example: 'الوجهات والمعالم' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiProperty({ description: 'Category URL slug', example: 'destinations' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  slug!: string;

  @ApiPropertyOptional({ description: 'Badge color name', example: 'emerald' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Lucide icon name', example: 'MapPin' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Short description', example: 'Photos of pyramids, historical landmarks and destinations' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateMediaCategoryDto {
  @ApiPropertyOptional({ description: 'Category name in English' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Category name in Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Badge color name' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Lucide icon name' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Short description' })
  @IsOptional()
  @IsString()
  description?: string;
}
