import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({ description: 'Localized question JSONB' })
  @IsObject()
  @IsNotEmpty()
  questionJsonb!: Record<string, string>;

  @ApiProperty({ description: 'Localized answer JSONB' })
  @IsObject()
  @IsNotEmpty()
  answerJsonb!: Record<string, string>;

  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Sort order index' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the item is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
