import { Injectable, Logger, Optional, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { decryptSensitiveField } from '../../../common/security/field-encryption.util';

// ============================================================
// AUTHORITATIVE PROVIDER REGISTRY
// Single source of truth for ALL provider configurations.
// Frontend must NEVER define base URLs independently.
// All changes to provider URLs must happen here only.
// Last verified: 2026-08-31
// ============================================================

export type ProviderApiStyle = 'openai-compatible' | 'anthropic-sdk' | 'openai-native';
export type ModelRecommendationTier = 'economy' | 'balanced' | 'premium' | 'fallback' | 'experimental';
export type ModelVerificationStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'DEPRECATED' | 'UNKNOWN';
export type ProviderErrorCode =
  | 'SUCCESS'
  | 'INVALID_KEY'
  | 'UNAUTHORIZED'
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PROVIDER_DOWN'
  | 'INVALID_CONFIGURATION'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

export interface DiscoveredModelMetadata {
  id: string;
  displayName: string;
  provider: string;
  supportsChat: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  contextWindow?: number;
  inputPricePer1M?: number;
  outputPricePer1M?: number;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'DEPRECATED';
  source: 'LIVE_PROVIDER';
}

export interface LiveModelDiscoveryResult {
  providerId: string;
  models: DiscoveredModelMetadata[];
  cached: boolean;
  timestamp: string;
}

// ============================================================
// PROVIDER DEFINITIONS
// ============================================================

export interface ProviderDefinition {
  id: string;
  displayName: string;
  logoSlug: string; // Used for logo lookup in frontend
  description: string;
  officialBaseUrl: string;       // ENFORCED server-side — never overridden for official providers
  apiStyle: ProviderApiStyle;
  documentationUrl: string;
  apiKeyUrl: string;             // Direct link to key creation page
  setupInstructions: string[];   // Step-by-step instructions shown in wizard
  supportsModelDiscovery: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  isEnabled: boolean;
  isRecommended: boolean;
  isLegacy: boolean;             // If true, not shown in primary wizard
  allowCustomBaseUrl: boolean;   // Only true for 'custom' provider
  primaryModels: string[];       // Ordered list of model IDs for this provider
}

export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  google: {
    id: 'google',
    displayName: 'Google Gemini',
    logoSlug: 'google',
    description: 'Fast, multilingual models with massive context windows. Optimal for travel conversations and RAG.',
    officialBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', // trailing slash required for OpenAI-compat
    apiStyle: 'openai-compatible',
    documentationUrl: 'https://ai.google.dev/gemini-api/docs',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    setupInstructions: [
      'Open Google AI Studio at aistudio.google.com',
      'Click "Get API Key" in the left sidebar',
      'Click "Create API key" and select a project',
      'Copy the generated Auth Key',
      'Paste it in the API Key field below',
    ],
    supportsModelDiscovery: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: true,
    isLegacy: false,
    allowCustomBaseUrl: false,
    primaryModels: [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
    ],
  },

  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    logoSlug: 'openai',
    description: 'Industry-leading models for complex reasoning and high-quality conversations.',
    officialBaseUrl: 'https://api.openai.com/v1',
    apiStyle: 'openai-native',
    documentationUrl: 'https://platform.openai.com/docs',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    setupInstructions: [
      'Open platform.openai.com and sign in',
      'Click your profile → "API keys"',
      'Click "Create new secret key"',
      'Give it a name (e.g. "Dunas Travel")',
      'Copy the key immediately (shown once)',
      'Paste it in the API Key field below',
    ],
    supportsModelDiscovery: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: true,
    isLegacy: false,
    allowCustomBaseUrl: false,
    primaryModels: [
      'gpt-4o-mini',
      'gpt-4o',
      'o3-mini',
    ],
  },

  xai: {
    id: 'xai',
    displayName: 'xAI / Grok',
    logoSlug: 'xai',
    description: 'xAI\'s Grok models. Optional provider for competitive cost/quality evaluation.',
    officialBaseUrl: 'https://api.x.ai/v1',
    apiStyle: 'openai-compatible',
    documentationUrl: 'https://docs.x.ai/docs',
    apiKeyUrl: 'https://console.x.ai/',
    setupInstructions: [
      'Open console.x.ai and sign in',
      'Navigate to "API Keys" in the sidebar',
      'Click "Create API Key"',
      'Copy the generated key',
      'Paste it in the API Key field below',
    ],
    supportsModelDiscovery: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: false,
    isLegacy: false,
    allowCustomBaseUrl: false,
    primaryModels: [
      'grok-3-mini',
      'grok-3',
      'grok-3-fast',
    ],
  },

  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    logoSlug: 'openrouter',
    description: 'Unified API for 200+ models. Strategic for cost comparison and fallback routing.',
    officialBaseUrl: 'https://openrouter.ai/api/v1',
    apiStyle: 'openai-compatible',
    documentationUrl: 'https://openrouter.ai/docs',
    apiKeyUrl: 'https://openrouter.ai/keys',
    setupInstructions: [
      'Open openrouter.ai and sign in',
      'Click your profile → "API Keys"',
      'Click "Create Key"',
      'Copy the generated key (starts with sk-or-)',
      'Paste it in the API Key field below',
    ],
    supportsModelDiscovery: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: true,
    isLegacy: false,
    allowCustomBaseUrl: false,
    primaryModels: [
      'deepseek/deepseek-chat-v3-0324',
      'deepseek/deepseek-r1',
      'qwen/qwen-2.5-72b-instruct',
      'google/gemini-2.0-flash-001',
    ],
  },

  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek Direct',
    logoSlug: 'deepseek',
    description: 'DeepSeek API directly. Compare against OpenRouter routing for cost optimization.',
    officialBaseUrl: 'https://api.deepseek.com',
    apiStyle: 'openai-compatible',
    documentationUrl: 'https://platform.deepseek.com/docs',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    setupInstructions: [
      'Open platform.deepseek.com and sign in',
      'Navigate to "API Keys" in the sidebar',
      'Click "Create new API key"',
      'Copy the key (starts with sk-)',
      'Paste it in the API Key field below',
    ],
    supportsModelDiscovery: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: false,
    isLegacy: false,
    allowCustomBaseUrl: false,
    primaryModels: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },

  custom: {
    id: 'custom',
    displayName: 'Custom OpenAI-Compatible',
    logoSlug: 'custom',
    description: 'Any OpenAI-compatible endpoint. You control the base URL and model ID.',
    officialBaseUrl: '', // Empty — user provides custom URL
    apiStyle: 'openai-compatible',
    documentationUrl: '',
    apiKeyUrl: '',
    setupInstructions: [
      'Enter the base URL of your OpenAI-compatible endpoint',
      'Enter your API key for authentication',
      'Enter the exact model ID as the provider expects it',
      'Test the connection before saving',
    ],
    supportsModelDiscovery: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    isEnabled: true,
    isRecommended: false,
    isLegacy: false,
    allowCustomBaseUrl: true,
    primaryModels: [],
  },

  // ── LEGACY (preserved, not shown in primary wizard) ──────────────
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic (Legacy)',
    logoSlug: 'anthropic',
    description: 'Claude models. Preserved for existing credentials but not part of primary strategy.',
    officialBaseUrl: 'https://api.anthropic.com/v1',
    apiStyle: 'anthropic-sdk',
    documentationUrl: 'https://docs.anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    setupInstructions: [
      'Open console.anthropic.com and sign in',
      'Navigate to "API Keys"',
      'Click "Create Key"',
      'Copy the key (starts with sk-ant-)',
      'Paste it in the API Key field below',
    ],
    supportsModelDiscovery: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: false,
    isLegacy: true,             // NOT shown in primary wizard
    allowCustomBaseUrl: false,
    primaryModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-7-sonnet-20250219',
    ],
  },
};

// ============================================================
// AUTHORITATIVE MODEL REGISTRY
// All model metadata lives here. Frontend reads this from the API.
// Pricing must be updated here when providers change rates.
// ============================================================

export interface ModelDefinition {
  id: string;                                    // Exact model ID as sent to the provider API
  providerId: string;                            // Must match a key in PROVIDER_REGISTRY
  displayName: string;
  displayNameAr: string;
  description: string;
  recommendation: ModelRecommendationTier;
  badge: 'Economy' | 'Balanced' | 'Advanced' | 'Premium' | 'Fallback' | 'Experimental';
  status: ModelVerificationStatus;
  lastVerifiedAt: string;                        // ISO date — update when verified
  // Capabilities
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  multilingualRating: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD';
  // Economics (per 1M tokens, USD) — update without code rewrite
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number;
  priceSource: string;                           // URL where pricing was verified
  priceVerifiedAt: string;                       // ISO date
  // Limits
  contextWindow: number;
  maxOutputTokens: number;
  // Display
  isPopular: boolean;
  isDefault: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelDefinition> = {

  // ── GOOGLE GEMINI ────────────────────────────────────────────────

  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    providerId: 'google',
    displayName: 'Gemini 3.7 Flash',
    displayNameAr: 'جيمناي 3.7 فلاش',
    description: 'Google\'s most capable production Flash model for complex agentic and multimodal workflows.',
    recommendation: 'premium',
    badge: 'Premium',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 3.75,
    cachedInputPricePerMillion: 0.075,
    priceSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    isPopular: true,
    isDefault: false,
  },

  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    providerId: 'google',
    displayName: 'Gemini 3.6 Flash',
    displayNameAr: 'جيمناي 3.6 فلاش',
    description: 'Fast production-grade Gemini model for general chat, tool use, and grounded travel workflows.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 3.75,
    cachedInputPricePerMillion: 0.075,
    priceSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    isPopular: true,
    isDefault: false,
  },

  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    providerId: 'google',
    displayName: 'Gemini 3.5 Flash',
    displayNameAr: 'جيمناي 3.5 فلاش',
    description: 'High-speed, production-grade model with ~900ms response time and full multimodal & tool support.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 3.00,
    cachedInputPricePerMillion: 0.05,
    priceSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    isPopular: true,
    isDefault: true,
  },

  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    providerId: 'google',
    displayName: 'Gemini 3.5 Flash-Lite',
    displayNameAr: 'جيمناي 3.5 فلاش لايت',
    description: 'Low-latency, cost-efficient production model for high-volume travel conversations and simple tasks.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 2.50,
    cachedInputPricePerMillion: 0.03,
    priceSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    isPopular: true,
    isDefault: false,
  },

  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    providerId: 'google',
    displayName: 'Gemini 3.1 Flash-Lite',
    displayNameAr: 'جيمناي 3.1 فلاش لايت',
    description: 'Cost-efficient stable Gemini model for high-volume, lightweight multilingual tasks.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.50,
    cachedInputPricePerMillion: 0.025,
    priceSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    isPopular: false,
    isDefault: false,
  },

  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    providerId: 'google',
    displayName: 'Gemini 2.5 Flash',
    displayNameAr: 'جيميناي 2.5 فلاش (الموصى به حالياً والأحدث)',
    description: 'Next-generation Gemini flagship flash model with enhanced multimodal and reasoning capabilities.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    cachedInputPricePerMillion: 0.025,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: true,
    isDefault: false,
  },

  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash',
    displayNameAr: 'جيميناي 2.0 فلاش (المستقر السريع)',
    description: 'Fastest next-gen multimodal model with 1M context. Standard for luxury travel conversations.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'DEPRECATED',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    cachedInputPricePerMillion: 0.025,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: true,
    isDefault: false,
  },

  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash Lite [Deprecated]',
    displayNameAr: 'جيميناي 2.0 فلاش لايت (متوقف)',
    description: 'Deprecated/shut down model. No longer available for production routing.',
    recommendation: 'experimental',
    badge: 'Economy',
    status: 'DEPRECATED',
    lastVerifiedAt: '2026-08-31',
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    multilingualRating: 'GOOD',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-31',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },

  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    providerId: 'google',
    displayName: 'Gemini 1.5 Flash',
    displayNameAr: 'جيميناي 1.5 فلاش (المستقر السريع)',
    description: 'Battle-tested high-speed model with 1M context. Ideal for live travel chat.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'DEPRECATED',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    cachedInputPricePerMillion: 0.01875,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: true,
    isDefault: false,
  },

  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    providerId: 'google',
    displayName: 'Gemini 1.5 Pro',
    displayNameAr: 'جيميناي 1.5 برو (أعلى ذكاء وتحليل عميق)',
    description: 'Premier complex reasoning model with 2M context window. Perfect for complex multi-day custom tours.',
    recommendation: 'premium',
    badge: 'Premium',
    status: 'DEPRECATED',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    cachedInputPricePerMillion: 0.31,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 2_097_152,
    maxOutputTokens: 8_192,
    isPopular: true,
    isDefault: false,
  },

  'gemini-1.5-flash-8b': {
    id: 'gemini-1.5-flash-8b',
    providerId: 'google',
    displayName: 'Gemini 1.5 Flash-8B',
    displayNameAr: 'جيميناي 1.5 فلاش 8B (خفيف للمهام السريعة)',
    description: 'High-volume, small footprint model for quick categorization, translation, and simple answers.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'DEPRECATED',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 0.0375,
    outputPricePerMillion: 0.15,
    cachedInputPricePerMillion: 0.01,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },

  // ── OPENAI ───────────────────────────────────────────────────────

  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o Mini',
    displayNameAr: 'جي بي تي 4 أومني ميني (اقتصادي وسريع)',
    description: 'Cost-effective multimodal model. Good for volume FAQ handling.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    priceSource: 'https://openai.com/api/pricing',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    isPopular: true,
    isDefault: false,
  },

  'gpt-4o': {
    id: 'gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    displayNameAr: 'جي بي تي 4 أومني (المتوازن المتقدم)',
    description: 'Flagship OpenAI multimodal model. Strong for complex travel conversations.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    priceSource: 'https://openai.com/api/pricing',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    isPopular: true,
    isDefault: true,
  },

  'o3-mini': {
    id: 'o3-mini',
    providerId: 'openai',
    displayName: 'o3 Mini (Reasoning)',
    displayNameAr: 'أو 3 ميني (استنتاج وتفكير منطقي)',
    description: 'Reasoning-focused model for complex itinerary planning.',
    recommendation: 'premium',
    badge: 'Advanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    priceSource: 'https://openai.com/api/pricing',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    isPopular: false,
    isDefault: false,
  },

  // ── XAI / GROK ───────────────────────────────────────────────────

  'grok-3-mini': {
    id: 'grok-3-mini',
    providerId: 'xai',
    displayName: 'Grok 3 Mini',
    displayNameAr: 'غروك 3 ميني (اقتصادي)',
    description: 'xAI economy model for cost-effective processing.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 0.50,
    priceSource: 'https://docs.x.ai/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 131_072,
    maxOutputTokens: 16_000,
    isPopular: false,
    isDefault: false,
  },

  'grok-3': {
    id: 'grok-3',
    providerId: 'xai',
    displayName: 'Grok 3',
    displayNameAr: 'غروك 3 (المتوازن)',
    description: 'xAI standard model for balanced performance.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    priceSource: 'https://docs.x.ai/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 131_072,
    maxOutputTokens: 16_000,
    isPopular: false,
    isDefault: false,
  },

  'grok-3-fast': {
    id: 'grok-3-fast',
    providerId: 'xai',
    displayName: 'Grok 3 Fast',
    displayNameAr: 'غروك 3 فاست (السريع)',
    description: 'xAI fast model with reduced latency.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 25.00,
    priceSource: 'https://docs.x.ai/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 131_072,
    maxOutputTokens: 16_000,
    isPopular: false,
    isDefault: false,
  },

  // ── OPENROUTER ───────────────────────────────────────────────────

  'deepseek/deepseek-chat-v3-0324': {
    id: 'deepseek/deepseek-chat-v3-0324',
    providerId: 'openrouter',
    displayName: 'DeepSeek V3 Flash (via OpenRouter)',
    displayNameAr: 'ديب سيك V3 فلاش (عبر أوبن راوتر)',
    description: 'Primary fallback model. Excellent cost/quality ratio for Arabic+English.',
    recommendation: 'fallback',
    badge: 'Fallback',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
    priceSource: 'https://openrouter.ai/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 163_840,
    maxOutputTokens: 8_000,
    isPopular: true,
    isDefault: false,
  },

  'deepseek/deepseek-r1': {
    id: 'deepseek/deepseek-r1',
    providerId: 'openrouter',
    displayName: 'DeepSeek R1 (via OpenRouter)',
    displayNameAr: 'ديب سيك R1 (عبر أوبن راوتر)',
    description: 'Reasoning model via OpenRouter. For complex itinerary planning fallback.',
    recommendation: 'experimental',
    badge: 'Experimental',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    priceSource: 'https://openrouter.ai/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 163_840,
    maxOutputTokens: 32_000,
    isPopular: false,
    isDefault: false,
  },

  'qwen/qwen-2.5-72b-instruct': {
    id: 'qwen/qwen-2.5-72b-instruct',
    providerId: 'openrouter',
    displayName: 'Qwen 2.5 72B (via OpenRouter)',
    displayNameAr: 'كيوين 2.5 72B (عبر أوبن راوتر)',
    description: 'Strong multilingual open-source model. Good for Arabic+English conversations.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.35,
    outputPricePerMillion: 0.40,
    priceSource: 'https://openrouter.ai/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },

  'google/gemini-2.0-flash-001': {
    id: 'google/gemini-2.0-flash-001',
    providerId: 'openrouter',
    displayName: 'Gemini 2.0 Flash (via OpenRouter)',
    displayNameAr: 'جيميناي 2.0 فلاش (عبر أوبن راوتر)',
    description: 'Gemini 2.0 Flash via OpenRouter — useful as a no-key fallback.',
    recommendation: 'fallback',
    badge: 'Fallback',
    status: 'DEPRECATED',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    priceSource: 'https://openrouter.ai/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },

  // ── DEEPSEEK DIRECT ──────────────────────────────────────────────

  'deepseek-chat': {
    id: 'deepseek-chat',
    providerId: 'deepseek',
    displayName: 'DeepSeek V3 Chat',
    displayNameAr: 'ديب سيك V3 شات (مباشر)',
    description: 'DeepSeek V3 direct — compare cost vs via OpenRouter.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
    priceSource: 'https://platform.deepseek.com/docs',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 64_000,
    maxOutputTokens: 8_000,
    isPopular: true,
    isDefault: false,
  },

  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    providerId: 'deepseek',
    displayName: 'DeepSeek R1 Reasoner',
    displayNameAr: 'ديب سيك R1 ريزنر (مباشر)',
    description: 'DeepSeek reasoning model for complex multi-step tasks.',
    recommendation: 'experimental',
    badge: 'Experimental',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    priceSource: 'https://platform.deepseek.com/docs',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 64_000,
    maxOutputTokens: 8_000,
    isPopular: false,
    isDefault: false,
  },

  // ── ANTHROPIC (LEGACY — preserved, not promoted) ─────────────────

  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    providerId: 'anthropic',
    displayName: 'Claude 3.5 Sonnet (Legacy)',
    displayNameAr: 'كلود 3.5 سونيت (موروث)',
    description: 'Legacy Anthropic model. Preserved for existing deployments.',
    recommendation: 'experimental',
    badge: 'Experimental',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    priceSource: 'https://www.anthropic.com/pricing',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },

  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    providerId: 'anthropic',
    displayName: 'Claude 3.5 Haiku (Legacy)',
    displayNameAr: 'كلود 3.5 هايكو (موروث)',
    description: 'Fast legacy Anthropic model. Preserved for existing deployments.',
    recommendation: 'experimental',
    badge: 'Experimental',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'VERY_GOOD',
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
    priceSource: 'https://www.anthropic.com/pricing',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },

  'claude-3-7-sonnet-20250219': {
    id: 'claude-3-7-sonnet-20250219',
    providerId: 'anthropic',
    displayName: 'Claude 3.7 Sonnet (Legacy)',
    displayNameAr: 'كلود 3.7 سونيت (موروث)',
    description: 'Latest legacy Anthropic model. Preserved for existing deployments.',
    recommendation: 'experimental',
    badge: 'Experimental',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    priceSource: 'https://www.anthropic.com/pricing',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    isPopular: false,
    isDefault: false,
  },
};

// ============================================================
// VALIDATION HELPERS & ALIAS RESOLUTION
// ============================================================

export const MODEL_ALIASES: Record<string, string> = {
  'gpt-5.6-luna': 'gpt-4o',
};

export function normalizeModelId(model: string): string {
  return MODEL_ALIASES[model] || model;
}

export function validateBaseUrl(url: string): { valid: boolean; reason?: string } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, reason: 'Base URL cannot be empty' };
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Base URL must start with http:// or https://' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Base URL is not a valid URL format' };
  }
}

/**
 * Returns all valid model IDs for a given provider.
 * OpenRouter is special: its models can also be used by the 'openrouter' provider ID.
 */
export function getValidModelIdsForProvider(providerId: string): string[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => m.providerId === providerId && m.status !== 'DEPRECATED')
    .map((m) => m.id);
}

/**
 * Validates that the model belongs to the provider.
 * Returns true if valid, false if mismatch.
 */
export function isValidProviderModelPair(providerId: string, modelId: string): boolean {
  const resolvedModelId = normalizeModelId(modelId);
  if (isRetiredGoogleModel(resolvedModelId)) {
    return false;
  }
  const model = MODEL_REGISTRY[resolvedModelId];
  if (!model) return providerId === 'custom';
  if (model.status === 'DEPRECATED' || model.status === 'UNAVAILABLE') return false;
  if (model.providerId === providerId) return true;
  if (providerId === 'custom') return true;
  return false;
}

const RETIRED_GOOGLE_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  'gemini-2.5-flash-lite',
  'google/gemini-2.0-flash-001',
]);

export function isRetiredGoogleModel(modelId: string): boolean {
  return RETIRED_GOOGLE_MODELS.has(modelId.replace(/^models\//, ''));
}

/**
 * Returns the official base URL for a provider.
 * For official providers this is always the server-authoritative value.
 * Only 'custom' provider accepts an override.
 */
export function getOfficialBaseUrl(providerId: string, customBaseUrl?: string): string {
  const provider = PROVIDER_REGISTRY[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  if (provider.allowCustomBaseUrl && customBaseUrl) return customBaseUrl.replace(/\/+$/, '');
  return provider.officialBaseUrl.replace(/\/+$/, '');
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);
  private readonly discoveryCache = new Map<string, { models: DiscoveredModelMetadata[]; timestamp: number }>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  invalidateDiscoveryCache(providerId?: string) {
    if (providerId) {
      const prefix = providerId.toLowerCase() + ':';
      for (const k of this.discoveryCache.keys()) {
        if (k.startsWith(prefix)) this.discoveryCache.delete(k);
      }
    } else {
      this.discoveryCache.clear();
    }
  }

  async discoverLiveModels(
    providerId: string,
    options: {
      credentialId?: string;
      apiKey?: string;
      baseUrl?: string;
      integrationMode?: 'openai-compatible' | 'google-native';
      forceRefresh?: boolean;
    } = {},
  ): Promise<LiveModelDiscoveryResult> {
    const pId = providerId.toLowerCase();
    const provider = PROVIDER_REGISTRY[pId];
    if (!provider) {
      throw new BadRequestException(`Unknown provider '${providerId}'. Supported: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`);
    }

    if (options.baseUrl) {
      const urlCheck = validateBaseUrl(options.baseUrl);
      if (!urlCheck.valid) {
        throw new BadRequestException(`Invalid base URL for provider '${providerId}': ${urlCheck.reason}`);
      }
    }

    // Resolve API key
    let apiKey = options.apiKey && !options.apiKey.includes('••') ? options.apiKey.trim() : '';
    if (!apiKey && options.credentialId && this.prisma) {
      const cred = await (this.prisma as any).aiProviderCredential.findUnique({ where: { id: options.credentialId } });
      if (cred?.encryptedApiKey) {
        apiKey = decryptSensitiveField(cred.encryptedApiKey) || '';
      }
    }
    if (!apiKey && this.prisma) {
      const cred = await (this.prisma as any).aiProviderCredential.findFirst({
        where: { provider: pId, isActive: true },
        orderBy: { priority: 'asc' },
      });
      if (cred?.encryptedApiKey) {
        apiKey = decryptSensitiveField(cred.encryptedApiKey) || '';
      }
    }

    if (!apiKey || apiKey.length < 5) {
      throw new BadRequestException(`An API key is required to query live models for provider '${providerId}'.`);
    }

    // Cache check
    const cacheKey = `${pId}:${options.baseUrl || 'default'}:${options.integrationMode || 'default'}:${apiKey.slice(0, 8)}`;
    const cached = this.discoveryCache.get(cacheKey);
    if (cached && !options.forceRefresh && Date.now() - cached.timestamp < 3600_000) {
      return {
        providerId: pId,
        models: cached.models,
        cached: true,
        timestamp: new Date(cached.timestamp).toISOString(),
      };
    }

    const discovered: DiscoveredModelMetadata[] = [];
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 12_000);

    try {
      if (pId === 'google') {
        // Try Google Native API first (fastest, most reliable, supports all keys)
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
          const res = await fetch(url, { signal: abortController.signal });
          if (res.ok) {
            const json: any = await res.json();
            const list = json.models || [];
            for (const item of list) {
              const rawId = (item.name || '').replace(/^models\//, '');
              if (!rawId || isRetiredGoogleModel(rawId)) continue;
              const methods = item.supportedGenerationMethods || [];
              if (!methods.includes('generateContent')) continue;

              const registered = MODEL_REGISTRY[rawId];
              discovered.push({
                id: rawId,
                displayName: item.displayName || registered?.displayName || rawId,
                provider: 'google',
                supportsChat: true,
                supportsStreaming: true,
                supportsTools: true,
                supportsStructuredOutput: true,
                contextWindow: item.inputTokenLimit || registered?.contextWindow || 1_048_576,
                inputPricePer1M: registered?.inputPricePerMillion,
                outputPricePer1M: registered?.outputPricePerMillion,
                status: 'AVAILABLE',
                source: 'LIVE_PROVIDER',
              });
            }
          }
        } catch (err: any) {
          this.logger.warn(`Google Native models API failed (${err.message}). Trying OpenAI-compatible...`);
        }

        // If native didn't find models, try OpenAI-compatible endpoint
        if (discovered.length === 0) {
          try {
            const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
            const url = `${baseUrl}/models`;
            const res = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'x-goog-api-key': apiKey,
              },
              signal: abortController.signal,
            });
            if (res.ok) {
              const json: any = await res.json();
              const list = json.data || [];
              for (const item of list) {
                const rawId = (item.id || '').replace(/^models\//, '');
                if (!rawId || isRetiredGoogleModel(rawId)) continue;
                const registered = MODEL_REGISTRY[rawId];
                discovered.push({
                  id: rawId,
                  displayName: registered?.displayName || rawId.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                  provider: 'google',
                  supportsChat: true,
                  supportsStreaming: true,
                  supportsTools: true,
                  supportsStructuredOutput: true,
                  contextWindow: registered?.contextWindow || 1_048_576,
                  inputPricePer1M: registered?.inputPricePerMillion,
                  outputPricePer1M: registered?.outputPricePerMillion,
                  status: 'AVAILABLE',
                  source: 'LIVE_PROVIDER',
                });
              }
            }
          } catch (err: any) {
            this.logger.warn(`Google OpenAI-compatible models API failed (${err.message}).`);
          }
        }

        // If provider live discovery is still empty, fall back to registered Google models
        if (discovered.length === 0) {
          const registeredGoogle = this.getPrimaryModelsForProvider('google');
          for (const m of registeredGoogle) {
            discovered.push({
              id: m.id,
              displayName: m.displayName,
              provider: 'google',
              supportsChat: true,
              supportsStreaming: true,
              supportsTools: true,
              supportsStructuredOutput: true,
              contextWindow: m.contextWindow,
              inputPricePer1M: m.inputPricePerMillion,
              outputPricePer1M: m.outputPricePerMillion,
              status: 'AVAILABLE',
              source: 'LIVE_PROVIDER',
            });
          }
        }
      } else if (pId === 'openai') {
        const url = 'https://api.openai.com/v1/models';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: abortController.signal,
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`OpenAI API returned ${res.status}: ${errBody.slice(0, 150)}`);
        }
        const json: any = await res.json();
        const list = json.data || [];
        for (const item of list) {
          const id = item.id || '';
          if (!id.startsWith('gpt-') && !id.startsWith('o1') && !id.startsWith('o3') && !id.startsWith('chatgpt')) continue;
          if (id.includes('audio') || id.includes('realtime') || id.includes('transcribe') || id.includes('tts')) continue;

          const registered = MODEL_REGISTRY[id];
          discovered.push({
            id,
            displayName: registered?.displayName || id,
            provider: 'openai',
            supportsChat: true,
            supportsStreaming: true,
            supportsTools: true,
            supportsStructuredOutput: true,
            contextWindow: registered?.contextWindow || 128_000,
            inputPricePer1M: registered?.inputPricePerMillion,
            outputPricePer1M: registered?.outputPricePerMillion,
            status: 'AVAILABLE',
            source: 'LIVE_PROVIDER',
          });
        }
      } else if (pId === 'openrouter') {
        const url = 'https://openrouter.ai/api/v1/models';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: abortController.signal,
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`OpenRouter API returned ${res.status}: ${errBody.slice(0, 150)}`);
        }
        const json: any = await res.json();
        const list = json.data || [];
        for (const item of list.slice(0, 150)) {
          const id = item.id || '';
          if (!id) continue;
          const promptPrice = item.pricing?.prompt ? Number(item.pricing.prompt) * 1_000_000 : undefined;
          const compPrice = item.pricing?.completion ? Number(item.pricing.completion) * 1_000_000 : undefined;
          discovered.push({
            id,
            displayName: item.name || id,
            provider: 'openrouter',
            supportsChat: true,
            supportsStreaming: true,
            supportsTools: Boolean(item.description?.includes('tool') || item.architecture?.instruct_type),
            supportsStructuredOutput: true,
            contextWindow: item.context_length || 128_000,
            inputPricePer1M: promptPrice,
            outputPricePer1M: compPrice,
            status: 'AVAILABLE',
            source: 'LIVE_PROVIDER',
          });
        }
      } else if (pId === 'xai') {
        const url = 'https://api.x.ai/v1/models';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: abortController.signal,
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`xAI API returned ${res.status}: ${errBody.slice(0, 150)}`);
        }
        const json: any = await res.json();
        const list = json.data || [];
        for (const item of list) {
          const id = item.id || '';
          if (!id) continue;
          const registered = MODEL_REGISTRY[id];
          discovered.push({
            id,
            displayName: registered?.displayName || id,
            provider: 'xai',
            supportsChat: true,
            supportsStreaming: true,
            supportsTools: true,
            supportsStructuredOutput: true,
            contextWindow: registered?.contextWindow || 131_072,
            inputPricePer1M: registered?.inputPricePerMillion,
            outputPricePer1M: registered?.outputPricePerMillion,
            status: 'AVAILABLE',
            source: 'LIVE_PROVIDER',
          });
        }
      } else if (pId === 'deepseek') {
        const url = 'https://api.deepseek.com/models';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: abortController.signal,
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`DeepSeek API returned ${res.status}: ${errBody.slice(0, 150)}`);
        }
        const json: any = await res.json();
        const list = json.data || [];
        for (const item of list) {
          const id = item.id || '';
          if (!id) continue;
          const registered = MODEL_REGISTRY[id];
          discovered.push({
            id,
            displayName: registered?.displayName || id,
            provider: 'deepseek',
            supportsChat: true,
            supportsStreaming: true,
            supportsTools: true,
            supportsStructuredOutput: true,
            contextWindow: registered?.contextWindow || 64_000,
            inputPricePer1M: registered?.inputPricePerMillion,
            outputPricePer1M: registered?.outputPricePerMillion,
            status: 'AVAILABLE',
            source: 'LIVE_PROVIDER',
          });
        }
      } else if (pId === 'custom') {
        const base = (options.baseUrl || '').replace(/\/+$/, '');
        if (!base) {
          throw new BadRequestException('Base URL is required for custom provider model discovery.');
        }
        const url = `${base}/models`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: abortController.signal,
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Custom endpoint returned ${res.status}: ${errBody.slice(0, 150)}`);
        }
        const json: any = await res.json();
        const list = json.data || json.models || [];
        for (const item of list) {
          const id = item.id || item.name || '';
          if (!id) continue;
          discovered.push({
            id,
            displayName: item.displayName || id,
            provider: 'custom',
            supportsChat: true,
            supportsStreaming: true,
            supportsTools: false,
            supportsStructuredOutput: true,
            contextWindow: 128_000,
            status: 'AVAILABLE',
            source: 'LIVE_PROVIDER',
          });
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new BadRequestException(`Model discovery timed out connecting to '${providerId}'.`);
      }
      this.logger.warn(`Model discovery failed for provider '${providerId}': ${err.message}`);
      throw new BadRequestException(`Failed to discover live models from '${providerId}': ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (discovered.length === 0) {
      throw new BadRequestException(`No active chat-compatible models were found for provider '${providerId}' with the provided API key.`);
    }

    this.discoveryCache.set(cacheKey, { models: discovered, timestamp: Date.now() });

    return {
      providerId: pId,
      models: discovered,
      cached: false,
      timestamp: new Date().toISOString(),
    };
  }

  getProviderRegistry(): ProviderDefinition[] {
    return Object.values(PROVIDER_REGISTRY).filter((p) => !p.isLegacy);
  }

  getAllProviders(): ProviderDefinition[] {
    return Object.values(PROVIDER_REGISTRY);
  }

  getProvider(providerId: string): ProviderDefinition | undefined {
    return PROVIDER_REGISTRY[providerId.toLowerCase()];
  }

  getAllModels(): ModelDefinition[] {
    return Object.values(MODEL_REGISTRY).filter((m) => m.status !== 'DEPRECATED');
  }

  getModelsByProvider(providerId: string): ModelDefinition[] {
    return Object.values(MODEL_REGISTRY).filter(
      (m) => m.providerId === providerId.toLowerCase() && m.status !== 'DEPRECATED',
    );
  }

  getPrimaryModelsForProvider(providerId: string): ModelDefinition[] {
    const provider = PROVIDER_REGISTRY[providerId.toLowerCase()];
    if (!provider) return [];
    return provider.primaryModels
      .map((id) => MODEL_REGISTRY[id])
      .filter((m) => Boolean(m) && m.status !== 'DEPRECATED');
  }

  getModel(modelId: string): ModelDefinition | undefined {
    const resolved = normalizeModelId(modelId);
    return MODEL_REGISTRY[resolved];
  }

  validateProviderModelPair(providerId: string, modelId: string): { valid: boolean; reason?: string } {
    const pId = providerId.toLowerCase();
    const provider = PROVIDER_REGISTRY[pId];
    if (!provider) {
      return { valid: false, reason: `Provider '${providerId}' is not in the registry.` };
    }
    const resolvedModelId = normalizeModelId(modelId);
    if (isRetiredGoogleModel(resolvedModelId)) {
      return {
        valid: false,
        reason: `Model '${modelId}' is deprecated/shut down and no longer available. Refresh the provider model list and select an active model.`,
      };
    }
    if (pId === 'custom') {
      return { valid: true };
    }
    const model = MODEL_REGISTRY[resolvedModelId];
    if (!model) {
      // Check if it's in discovered models or registered
      return { valid: true };
    }
    if (model.status === 'DEPRECATED' || model.status === 'UNAVAILABLE') {
      return {
        valid: false,
        reason: `Model '${modelId}' is marked as ${model.status} and cannot be selected.`,
      };
    }
    if (model.providerId !== pId) {
      return {
        valid: false,
        reason: `Model '${modelId}' belongs to provider '${model.providerId}', not '${providerId}'. ` +
                `Valid models for '${providerId}': ${getValidModelIdsForProvider(providerId).join(', ')}`,
      };
    }
    return { valid: true };
  }

  getOfficialBaseUrl(providerId: string, customBaseUrl?: string): string {
    return getOfficialBaseUrl(providerId, customBaseUrl);
  }

  calculateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
    const resolved = normalizeModelId(modelId);
    const model = MODEL_REGISTRY[resolved];
    if (!model) return 0;
    const inCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
    const outCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
    return Number((inCost + outCost).toFixed(6));
  }

  // Legacy compatibility — returns shape expected by existing code
  getAvailableProviders() {
    return Object.values(PROVIDER_REGISTRY).map((p) => ({
      id: p.id,
      name: p.displayName,
      defaultBaseUrl: p.officialBaseUrl,
      defaultModel: p.primaryModels[0] || '',
      models: p.primaryModels,
      isLegacy: p.isLegacy,
      isRecommended: p.isRecommended,
      apiKeyUrl: p.apiKeyUrl,
      setupInstructions: p.setupInstructions,
      allowCustomBaseUrl: p.allowCustomBaseUrl,
    }));
  }

  // Legacy compatibility
  getModelInfo(modelId: string) {
    const m = MODEL_REGISTRY[modelId];
    if (!m) {
      return {
        id: modelId,
        provider: 'custom',
        name: modelId,
        nameAr: modelId,
        badge: 'Experimental' as const,
        contextWindow: 128_000,
        inputCostPer1M: 2.00,
        outputCostPer1M: 8.00,
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: false,
        multilingualRating: 'GOOD' as const,
        isPopular: false,
      };
    }
    return {
      id: m.id,
      provider: m.providerId,
      name: m.displayName,
      nameAr: m.displayNameAr,
      badge: m.badge,
      contextWindow: m.contextWindow,
      inputCostPer1M: m.inputPricePerMillion,
      outputCostPer1M: m.outputPricePerMillion,
      supportsToolCalling: m.supportsToolCalling,
      supportsStructuredOutput: m.supportsStructuredOutput,
      supportsVision: m.supportsVision,
      multilingualRating: m.multilingualRating,
      isPopular: m.isPopular,
    };
  }
}
