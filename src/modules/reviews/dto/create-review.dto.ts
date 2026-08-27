import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsUUID,
  MaxLength,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateReviewDto {
  @ApiPropertyOptional({
    description: 'ID of the completed booking for verified eligibility check',
  })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiProperty({ description: 'Rating between 1 and 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Reviewer name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reviewerName?: string;

  @ApiPropertyOptional({ description: 'Reviewer email address' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  comment?: string;
}

export class AdminCreateReviewDto {
  @ApiProperty({ description: 'Tour ID or Slug' })
  @IsString()
  @IsNotEmpty()
  tourId!: string;

  @ApiProperty({ description: 'Reviewer display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reviewerName!: string;

  @ApiProperty({ description: 'Rating score (1 to 5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Review comment text' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Official admin reply' })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminReply?: string;

  @ApiPropertyOptional({ description: 'Moderation status (APPROVED, PENDING, REJECTED)' })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Publish status flag' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class AdminUpdateReviewDto {
  @ApiPropertyOptional({ description: 'Tour ID or Slug' })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({ description: 'Reviewer display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reviewerName?: string;

  @ApiPropertyOptional({ description: 'Rating score (1 to 5)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Review comment text' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Official admin reply' })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminReply?: string;

  @ApiPropertyOptional({ description: 'Moderation status (APPROVED, PENDING, REJECTED)' })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Publish status flag' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

