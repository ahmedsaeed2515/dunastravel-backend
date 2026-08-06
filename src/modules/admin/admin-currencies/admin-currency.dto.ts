import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminCurrencyRateDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  code!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8, allowInfinity: false, allowNaN: false })
  @Min(0.00000001)
  @Max(1_000_000)
  rateToBase!: number;
}

export class UpdateAdminCurrencyRatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((rate: AdminCurrencyRateDto) => rate.code)
  @ValidateNested({ each: true })
  @Type(() => AdminCurrencyRateDto)
  rates!: AdminCurrencyRateDto[];
}
