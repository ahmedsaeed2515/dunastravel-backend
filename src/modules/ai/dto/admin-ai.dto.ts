import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max, IsArray, IsObject } from 'class-validator';

export class UpdateAiConfigDto {
  @ApiPropertyOptional({ example: 'anthropic' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: 'claude-3-5-sonnet-20241022' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublicEnabled?: boolean;

  @ApiPropertyOptional({ example: 'sk-ant-api03-...' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ example: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ example: 1024 })
  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsNumber()
  @IsOptional()
  requestTimeoutMs?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  systemInstructions?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  salesPersonality?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  toneOfVoice?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fallbackMessage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  escalationMessage?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  welcomeMessages?: Record<string, string>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  suggestedQuestions?: Record<string, string[]>;
}

export class TestProviderConnectionDto {
  @ApiPropertyOptional({ example: 'anthropic' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: 'claude-3-5-sonnet-20241022' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  apiKey?: string;
}
