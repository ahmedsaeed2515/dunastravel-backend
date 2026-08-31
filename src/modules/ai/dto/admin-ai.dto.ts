import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber,
  Min, Max, IsArray, IsObject, IsIn, ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

// ============================================================
// VALID PROVIDER IDS (server-side enumeration)
// ============================================================
const VALID_PROVIDER_IDS = ['google', 'openai', 'xai', 'openrouter', 'deepseek', 'custom', 'anthropic'];

export class UpdateAiConfigDto {
  @ApiPropertyOptional({ example: 'google', enum: VALID_PROVIDER_IDS })
  @IsString()
  @IsOptional()
  @IsIn(VALID_PROVIDER_IDS, { message: `provider must be one of: ${VALID_PROVIDER_IDS.join(', ')}` })
  provider?: string;

  @ApiPropertyOptional({ example: 'gemini-3.6-flash' })
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

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isInChatBookingEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Write-only API key — only stored encrypted, never returned' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ example: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(2)
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

// ============================================================
// ADD PROVIDER CREDENTIAL DTO
// ============================================================

export class AddProviderCredentialDto {
  @ApiProperty({
    example: 'google',
    enum: VALID_PROVIDER_IDS,
    description: 'Provider ID from the official registry',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_PROVIDER_IDS, { message: `provider must be one of: ${VALID_PROVIDER_IDS.join(', ')}` })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  provider!: string;

  @ApiProperty({
    example: 'AIza...',
    description: 'Write-only API key. Stored encrypted. Never returned.',
  })
  @IsString()
  @IsNotEmpty({ message: 'API key is required.' })
  apiKey!: string;

  @ApiPropertyOptional({
    example: 'gemini-3.6-flash',
    description: 'Default model for this credential. Must belong to the selected provider.',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'Production Gemini Key' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    example: 'https://my-proxy.example.com/v1',
    description: 'Custom base URL. Only applicable for provider=custom.',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.provider === 'custom')
  baseUrl?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ============================================================
// UPDATE PROVIDER CREDENTIAL DTO
// ============================================================

export class UpdateProviderCredentialDto {
  @ApiPropertyOptional({ enum: VALID_PROVIDER_IDS })
  @IsString()
  @IsOptional()
  @IsIn(VALID_PROVIDER_IDS, { message: `provider must be one of: ${VALID_PROVIDER_IDS.join(', ')}` })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  provider?: string;

  @ApiPropertyOptional({
    description: 'New API key. Leave blank to keep existing key.',
  })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ============================================================
// TEST PROVIDER CONNECTION DTO
// ============================================================

export class TestProviderConnectionDto {
  @ApiPropertyOptional({
    example: 'google',
    enum: VALID_PROVIDER_IDS,
    description: 'Provider to test. If omitted, uses the configured primary provider.',
  })
  @IsString()
  @IsOptional()
  @IsIn(VALID_PROVIDER_IDS, { message: `provider must be one of: ${VALID_PROVIDER_IDS.join(', ')}` })
  provider?: string;

  @ApiPropertyOptional({
    example: 'gemini-3.6-flash',
    description: 'Model to test with. Must belong to the specified provider.',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({
    description: 'API key to test. If omitted, uses the stored key for this provider.',
  })
  @IsString()
  @IsOptional()
  apiKey?: string;
}

// ============================================================
// GENERATE AI ITINERARY DTO
// ============================================================

export class GenerateAiItineraryDto {
  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  destinations?: string[];

  @ApiPropertyOptional({ example: 8 })
  @IsNumber()
  @IsOptional()
  durationDays?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsNumber()
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  nileCruise?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  beachExtension?: boolean;

  @ApiPropertyOptional({ example: 'LUXURY' })
  @IsString()
  @IsOptional()
  travelStyle?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

// ============================================================
// REFRESH PROVIDER MODELS DTO
// ============================================================

export class RefreshProviderModelsDto {
  @ApiPropertyOptional({ description: 'Credential ID from database to use stored key' })
  @IsString()
  @IsOptional()
  credentialId?: string;

  @ApiPropertyOptional({ description: 'In-flight API key for discovering models before saving' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Custom base URL if testing custom provider or custom endpoint' })
  @IsString()
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Integration mode for Google provider', enum: ['openai-compatible', 'google-native'] })
  @IsString()
  @IsOptional()
  @IsIn(['openai-compatible', 'google-native'])
  integrationMode?: 'openai-compatible' | 'google-native';
}

