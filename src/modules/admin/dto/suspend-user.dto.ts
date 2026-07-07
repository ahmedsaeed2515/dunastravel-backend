import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiProperty({ description: 'Reason for suspension' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
