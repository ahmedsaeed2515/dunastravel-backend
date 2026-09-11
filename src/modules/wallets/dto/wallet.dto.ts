import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WalletOwnerType,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class ManualWalletTransactionDto {
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

  // Optional: the dashboard does not send a reference; the controller generates
  // a unique one when omitted so the idempotency unique key still holds.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
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
