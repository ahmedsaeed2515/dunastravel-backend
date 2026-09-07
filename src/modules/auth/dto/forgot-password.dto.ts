import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({
    description: 'Cloudflare Turnstile challenge token',
    example: '0.xxxx.yyyy',
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
