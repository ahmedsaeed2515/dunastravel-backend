import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({ example: 'Carlos Méndez' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'carlos@agency.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+34 612 345 678' })
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'InitialPass123!' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
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
  @MinLength(1)
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '+34 699 999 999' })
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ example: 'uuid-of-company' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
