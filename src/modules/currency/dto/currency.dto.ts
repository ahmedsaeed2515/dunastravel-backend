import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ConvertCurrencyDto {
  @ApiProperty({ description: 'Amount to convert' })
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ description: 'Currency code to convert from (e.g., USD)' })
  @IsString()
  @IsNotEmpty()
  from!: string;

  @ApiProperty({ description: 'Currency code to convert to (e.g., EUR)' })
  @IsString()
  @IsNotEmpty()
  to!: string;
}
