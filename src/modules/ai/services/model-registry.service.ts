import { Injectable, Logger } from '@nestjs/common';

// ============================================================
// AUTHORITATIVE PROVIDER REGISTRY
// Single source of truth for ALL provider configurations.
// Frontend must NEVER define base URLs independently.
// All changes to provider URLs must happen here only.
// Last verified: 2026-08-30
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
    officialBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', // trailing slash required
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
    supportsModelDiscovery: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isEnabled: true,
    isRecommended: true,
    isLegacy: false,
    allowCustomBaseUrl: false,
    primaryModels: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash-8b',
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

  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash',
    displayNameAr: 'جيميناي 2.0 فلاش (المتوازن والموصى به)',
    description: 'Fastest next-gen multimodal model with 1M context. Recommended for all standard luxury travel conversations.',
    recommendation: 'balanced',
    badge: 'Balanced',
    status: 'AVAILABLE',
    lastVerifiedAt: '2026-08-30',
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    cachedInputPricePerMillion: 0.025,
    priceSource: 'https://ai.google.dev/gemini-api/docs/models',
    priceVerifiedAt: '2026-08-30',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    isPopular: true,
    isDefault: true,
  },

  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash Lite',
    displayNameAr: 'جيميناي 2.0 فلاش لايت (الاقتصادي الفائق)',
    description: 'Lowest cost, ultra-low latency model. Best for high-frequency FAQ and instant lookups.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
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

  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    providerId: 'google',
    displayName: 'Gemini 1.5 Flash',
    displayNameAr: 'جيميناي 1.5 فلاش (المستقر السريع)',
    description: 'Battle-tested high-speed model with 1M context. Ideal for live travel chat.',
    recommendation: 'economy',
    badge: 'Economy',
    status: 'AVAILABLE',
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
    status: 'AVAILABLE',
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
    status: 'AVAILABLE',
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
    status: 'AVAILABLE',
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
  'gemini-2.5-flash': 'gemini-2.0-flash',
  'gemini-2.5-flash-lite': 'gemini-2.0-flash-lite',
  'gemini-2.5-pro': 'gemini-1.5-pro',
  'gemini-3.7-flash': 'gemini-2.0-flash',
  'gpt-5.6-luna': 'gpt-4o',
  'google/gemini-2.5-flash': 'google/gemini-2.0-flash-001',
};

export function normalizeModelId(model: string): string {
  return MODEL_ALIASES[model] || model;
}

/**
 * Returns all valid model IDs for a given provider.
 * OpenRouter is special: its models can also be used by the 'openrouter' provider ID.
 */
export function getValidModelIdsForProvider(providerId: string): string[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => m.providerId === providerId)
    .map((m) => m.id);
}

/**
 * Validates that the model belongs to the provider.
 * Returns true if valid, false if mismatch.
 */
export function isValidProviderModelPair(providerId: string, modelId: string): boolean {
  const resolvedModelId = normalizeModelId(modelId);
  const model = MODEL_REGISTRY[resolvedModelId];
  if (!model) return false; // Unknown model — reject
  if (model.providerId === providerId) return true;
  // custom provider accepts any model
  if (providerId === 'custom') return true;
  return false;
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
    return Object.values(MODEL_REGISTRY);
  }

  getModelsByProvider(providerId: string): ModelDefinition[] {
    return Object.values(MODEL_REGISTRY).filter(
      (m) => m.providerId === providerId.toLowerCase(),
    );
  }

  getPrimaryModelsForProvider(providerId: string): ModelDefinition[] {
    const provider = PROVIDER_REGISTRY[providerId.toLowerCase()];
    if (!provider) return [];
    return provider.primaryModels
      .map((id) => MODEL_REGISTRY[id])
      .filter(Boolean);
  }

  getModel(modelId: string): ModelDefinition | undefined {
    const resolved = normalizeModelId(modelId);
    return MODEL_REGISTRY[resolved];
  }

  validateProviderModelPair(providerId: string, modelId: string): { valid: boolean; reason?: string } {
    const provider = PROVIDER_REGISTRY[providerId.toLowerCase()];
    if (!provider) {
      return { valid: false, reason: `Provider '${providerId}' is not in the registry.` };
    }
    if (providerId === 'custom') {
      return { valid: true };
    }
    const resolvedModelId = normalizeModelId(modelId);
    const model = MODEL_REGISTRY[resolvedModelId];
    if (!model) {
      return {
        valid: false,
        reason: `Model '${modelId}' is not in the registry. For custom models, use the 'custom' provider.`,
      };
    }
    if (model.providerId !== providerId.toLowerCase()) {
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
