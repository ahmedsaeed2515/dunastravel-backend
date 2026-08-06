import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Unique name of the template' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z][a-z0-9_]{2,99}$/)
  name!: string;

  @ApiProperty({ description: 'Subject line' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({ description: 'HTML body of the template' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  bodyHtml!: string;

  @ApiPropertyOptional({ description: 'JSON array of variable names' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[A-Za-z][A-Za-z0-9_]{0,49}$/, { each: true })
  variables?: string[];
}
