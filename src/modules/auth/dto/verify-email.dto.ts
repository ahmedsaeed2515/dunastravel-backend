import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiPropertyOptional({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'verify123token', description: 'Verification token string' })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  @IsOptional()
  email?: string;
}

