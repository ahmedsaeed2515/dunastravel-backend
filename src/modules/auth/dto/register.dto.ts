import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  email!: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+1 234 567 8900',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[0-9\s\-+]+$/, {
    message:
      'Phone number can only contain digits, spaces, dashes, and plus signs',
  })
  phone?: string;

  @ApiProperty({
    description:
      '12–128 characters. The password policy also requires at least three character types and rejects predictable values.',
    example: 'Journey!2026Atlas',
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
