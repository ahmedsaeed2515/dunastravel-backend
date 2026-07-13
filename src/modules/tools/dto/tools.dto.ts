import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TranslateHieroglyphicsDto {
  @ApiProperty({ example: 'John', description: 'Name to translate' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}
