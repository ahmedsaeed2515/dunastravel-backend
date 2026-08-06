import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!' })
  @IsString()
  oldPassword!: string;

  @ApiProperty({ example: 'NewPass123!' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
