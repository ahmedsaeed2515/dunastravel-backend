import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'verify123token' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
