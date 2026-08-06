import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user' })
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ description: 'Initial password' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ description: 'Confirm password' })
  @IsString()
  @IsOptional()
  @MaxLength(128)
  confirmPassword?: string;

  @ApiProperty({ description: 'User role', enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}
