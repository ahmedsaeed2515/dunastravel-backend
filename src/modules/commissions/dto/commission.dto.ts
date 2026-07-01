import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionStatus } from '@prisma/client';

export class CreateCommissionDto {
  @ApiProperty()
  @IsString()
  companyId!: string;

  @ApiProperty()
  @IsString()
  bookingId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  rate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class UpdateCommissionStatusDto {
  @ApiProperty({ enum: CommissionStatus })
  @IsEnum(CommissionStatus)
  status!: CommissionStatus;
}

export class CommissionQueryFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}
