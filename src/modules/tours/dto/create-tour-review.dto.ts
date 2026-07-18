import {
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTourReviewDto {
  @ApiProperty({ description: 'Rating between 1 and 5', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ description: 'Name of the reviewer', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}
