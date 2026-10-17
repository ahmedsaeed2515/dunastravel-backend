import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ahmed Saeed' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9\s\-+]{6,50}$/, {
    message:
      'phone number can only contain digits, spaces, dashes, and plus signs',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'Egyptian' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  preferredCurrency?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsString()
  @IsOptional()
  preferredLanguage?: string;
}
