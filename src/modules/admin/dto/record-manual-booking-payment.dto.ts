import { IsNumber, IsPositive, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordManualBookingPaymentDto {
  @ApiProperty({ example: 450.00, description: 'Payment amount in USD (positive, max 2 decimal places)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'CASH' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ example: 'TXN-12345' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
