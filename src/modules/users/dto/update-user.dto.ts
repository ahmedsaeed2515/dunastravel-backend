import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Ahmed Al-Rashid',
    description: 'Full name of the user',
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'ahmed@dunastravel.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: '+34 612 345 678',
    description: 'Phone number',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'NewSecurePass!23',
    description: 'New password (min 8 chars)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description: 'User role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
