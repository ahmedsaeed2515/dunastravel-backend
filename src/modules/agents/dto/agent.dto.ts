import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({ example: 'Carlos Méndez' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'carlos@agency.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+34 612 345 678' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'InitialPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'uuid-of-company',
    description: 'Link agent to a B2B company',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}

export class UpdateAgentDto {
  @ApiPropertyOptional({ example: 'Carlos Alberto Méndez' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+34 699 999 999' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'uuid-of-company' })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}

export class AgentQueryDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ example: 'uuid-of-company' })
  @IsOptional()
  companyId?: string;
}
