import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import {
  WalletOwnerType,
  WalletTransactionType,
  WalletTransactionStatus,
} from '@prisma/client';

export class CreateWalletTransactionDto {
  @ApiProperty({ enum: WalletOwnerType })
  @IsEnum(WalletOwnerType)
  ownerType!: WalletOwnerType;

  @ApiProperty()
  @IsUUID()
  ownerId!: string;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  amount!: number;

  @ApiProperty({ enum: WalletTransactionType })
  @IsEnum(WalletTransactionType)
  type!: WalletTransactionType;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  referenceType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  referenceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ enum: WalletTransactionStatus })
  @IsOptional()
  @IsEnum(WalletTransactionStatus)
  status?: WalletTransactionStatus;
}

export class ManualWalletTransactionDto extends OmitType(
  CreateWalletTransactionDto,
  ['referenceType', 'status'] as const,
) {}

export class WalletQueryFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(WalletOwnerType)
  ownerType?: WalletOwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class WalletTransactionQueryFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  referenceType?: string;
}

export class ListWalletsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WalletOwnerType })
  @IsOptional()
  @IsEnum(WalletOwnerType)
  ownerType?: WalletOwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

