import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2, allowInfinity: false, allowNaN: false })
  @Min(0.01)
  @Max(10_000_000)
  amount!: number;

  @ApiProperty({ default: 'USD' })
  @IsString()
  @IsIn(['USD'])
  currency!: string;

  @ApiProperty({
    description: 'Payment method (e.g. Credit Card, Wire Transfer)',
  })
  @IsString()
  @IsIn(['CASH', 'BANK_TRANSFER', 'POS', 'OTHER_MANUAL'])
  method!: string;

  @ApiProperty({
    description: 'Unique external receipt/reference used for safe retries',
  })
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:/-]{5,99}$/)
  transactionId!: string;
}
