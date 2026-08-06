import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 },
    {
      message: 'amount must be a finite monetary value with at most 2 decimals',
    },
  )
  @Min(0.01)
  amount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, {
    message: 'idempotencyKey has an invalid format',
  })
  idempotencyKey!: string;
}
