import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsString()
  bookingId!: string;

  @IsOptional()
  @IsString()
  provider?: string = 'STRIPE';
}
