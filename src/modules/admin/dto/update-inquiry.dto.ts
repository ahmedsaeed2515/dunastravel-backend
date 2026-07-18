import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { TailorMadeInquiryStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInquiryDto {
  @ApiPropertyOptional({
    enum: TailorMadeInquiryStatus,
    description: 'Status of the inquiry',
  })
  @IsOptional()
  @IsEnum(TailorMadeInquiryStatus)
  status?: TailorMadeInquiryStatus;

  @ApiPropertyOptional({
    description: 'ID of the agent assigned to this inquiry',
  })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Date to follow up' })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;

  @ApiPropertyOptional({ description: 'Internal note by the agent' })
  @IsOptional()
  @IsString()
  internalNote?: string;
}
