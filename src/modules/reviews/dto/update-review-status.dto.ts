import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class UpdateReviewStatusDto {
  @ApiProperty({ description: 'Review status (APPROVED, REJECTED, PENDING)' })
  @IsString()
  @IsNotEmpty()
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
  adminReply!: string;
}
