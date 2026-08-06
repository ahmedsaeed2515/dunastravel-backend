import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TranslateHieroglyphicsDto {
  @ApiProperty({ description: 'The name or short text to translate' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[\p{L}\p{M} .'-]+$/u)
  text!: string;
}
