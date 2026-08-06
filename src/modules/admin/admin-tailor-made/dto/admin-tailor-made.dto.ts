import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TailorMadeInquiryStatus } from '@prisma/client';

export class AdminTailorMadeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsEnum(TailorMadeInquiryStatus)
  status?: TailorMadeInquiryStatus;
}

export class UpdateTailorMadeStatusDto {
  @IsEnum(TailorMadeInquiryStatus)
  status!: TailorMadeInquiryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string;
}

export class AssignTailorMadeInquiryDto {
  @IsUUID('4')
  assigneeId!: string;
}

export class QuoteTailorMadeInquiryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2, allowInfinity: false, allowNaN: false })
  @Min(0.01)
  @Max(10_000_000)
  quotedAmountUsd!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  quoteNotes?: string;
}
