import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PayLinkCallbackDto {
  @IsIn(['0', '1', 'true', 'false', 0, 1, true, false])
  success!: string | number | boolean;

  @IsNotEmpty()
  invoice_id!: string | number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  invoice_status!: string;

  @IsString()
  @MaxLength(500)
  message!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  signature!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  auth_code?: string;
}
