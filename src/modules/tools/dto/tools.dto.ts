import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TranslateHieroglyphicsDto {
  @ApiProperty({ example: 'John', description: 'Name to translate' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[\p{L}\p{M} .'-]+$/u)
  text!: string;
}
