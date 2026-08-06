import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class AdminRefundDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId!: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  idempotencyKey!: string;
}
