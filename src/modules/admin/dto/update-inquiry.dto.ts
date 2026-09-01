import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
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
  @IsUUID('4')
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Date to follow up' })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;

  @ApiPropertyOptional({ description: 'Internal note by the agent' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  internalNote?: string;

  @ApiPropertyOptional({ description: 'Quoted amount in USD for the inquiry' })
  @IsOptional()
  quotedAmountUsd?: number;

  @ApiPropertyOptional({ description: 'Customer notes or special requests' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string;
}
