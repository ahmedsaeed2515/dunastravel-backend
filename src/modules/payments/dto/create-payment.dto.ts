import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  @IsString()
  bookingId!: string;
}
