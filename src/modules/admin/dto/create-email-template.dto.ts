import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Unique name of the template' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Subject line' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'HTML body of the template' })
  @IsString()
  @IsNotEmpty()
  bodyHtml!: string;

  @ApiPropertyOptional({ description: 'JSON array of variable names' })
  @IsOptional()
  @IsObject()
  variables?: string[];
}
