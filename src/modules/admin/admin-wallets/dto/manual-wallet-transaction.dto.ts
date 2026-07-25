import {
  IsNumber,
  Min,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletTransactionType } from '@prisma/client';

export class ManualWalletTransactionDto {
  @ApiProperty({
    description: 'Transaction amount (must be > 0)',
    example: 100,
  })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description: 'Transaction type',
    enum: WalletTransactionType,
    example: 'CREDIT',
  })
  @IsEnum(WalletTransactionType)
  type!: WalletTransactionType;

  @ApiProperty({
    description: 'Mandatory reason for manual adjustment',
    example: 'Manual deposit compensation',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional unique reference or idempotency key',
    example: 'REF-WAL-001',
  })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
