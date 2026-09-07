import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordManualBookingPaymentDto {
  @ApiProperty({
    example: 450.0,
    description: 'Amount paid in USD (must be positive, minimum 0.01)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    example: 'CASH',
    description: 'Payment method (CASH, BANK_TRANSFER, POS, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;

  @ApiPropertyOptional({
    example: 'TX-OFFLINE-98234',
    description: 'External transaction reference or receipt number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionId?: string;

  @ApiPropertyOptional({
    example: 'Received in office by Ahmed',
    description: 'Internal accounting or audit notes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
