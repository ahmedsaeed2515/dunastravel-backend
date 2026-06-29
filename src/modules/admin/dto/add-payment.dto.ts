import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class AddPaymentDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ default: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({
    description: 'Payment method (e.g. Credit Card, Wire Transfer)',
  })
  @IsString()
  @IsNotEmpty()
  method!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiProperty({ default: false, description: 'True if this is a refund' })
  @IsBoolean()
  @IsOptional()
  isRefund?: boolean;
}
