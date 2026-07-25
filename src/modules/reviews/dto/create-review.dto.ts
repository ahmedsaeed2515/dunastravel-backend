import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'ID of the completed booking for eligibility check',
  })
  @IsString()
  @IsNotEmpty()
  bookingId!: string;

  @ApiProperty({ description: 'Rating between 1 and 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Reviewer display name' })
  @IsOptional()
  @IsString()
  reviewerName?: string;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}
