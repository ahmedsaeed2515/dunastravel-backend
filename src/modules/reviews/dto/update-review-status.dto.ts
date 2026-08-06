import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';

export class UpdateReviewStatusDto {
  @ApiProperty({ description: 'Review status (APPROVED, REJECTED, PENDING)' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status!: string;

  @ApiPropertyOptional({ description: 'Whether the review is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class AdminReplyReviewDto {
  @ApiProperty({ description: 'Admin reply content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  adminReply!: string;
}
