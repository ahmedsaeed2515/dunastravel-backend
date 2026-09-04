import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  bookingId!: string;

  @IsOptional()
  @IsString()
  guestToken?: string;
}
