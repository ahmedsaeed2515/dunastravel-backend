import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  bookingId!: string;

  @IsOptional()
  @IsString()
  provider?: string = 'STRIPE';
}
