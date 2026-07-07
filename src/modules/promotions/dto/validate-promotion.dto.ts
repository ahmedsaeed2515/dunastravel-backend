import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePromotionDto {
  @ApiProperty({ description: 'Promotion code to validate' })
  @IsString()
  @IsNotEmpty()
  promoCode!: string;
}
