import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ahmed Saeed' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  preferredCurrency?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsString()
  @IsOptional()
  preferredLanguage?: string;
}
