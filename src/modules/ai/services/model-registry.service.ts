import { Injectable, Logger } from '@nestjs/common';

export interface ModelCapability {
  id: string;
  provider: string; // 'anthropic' | 'google' | 'openai' | 'deepseek' | 'openrouter' | 'custom'
  name: string;
  nameAr: string;
  badge: 'Flagship' | 'Recommended' | 'Fast' | 'Reasoning' | 'Light' | 'OpenSource';
  contextWindow: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  multilingualRating: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD';
  isPopular: boolean;
  isDeprecated?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: string[];
}

export const SUPPORTED_MODEL_REGISTRY: Record<string, ModelCapability> = {
  // --- Anthropic ---
  'claude-3-7-sonnet-20250219': {
    id: 'claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    name: 'Claude 3.7 Sonnet (Hybrid Thinking)',
    nameAr: 'كلود 3.7 سونيت (تفكير هجين - الأحدث)',
    badge: 'Flagship',
    contextWindow: 200_000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    nameAr: 'كلود 3.5 سونيت (الرائد في الدقة السياحية)',
    badge: 'Recommended',
    contextWindow: 200_000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    name: 'Claude 3.5 Haiku',
    nameAr: 'كلود 3.5 هايكو (فائق السرعة والاستجابة)',
    badge: 'Fast',
    contextWindow: 200_000,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'VERY_GOOD',
    isPopular: true,
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    nameAr: 'كلود 3 أوبوس (تحليل معمق وصياغة فاخرة)',
    badge: 'Flagship',
    contextWindow: 200_000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: false,
  },

  // --- Google Gemini ---
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    nameAr: 'جيميناي 2.5 برو (أعلى ذكاء وتحليل وتفكير)',
    badge: 'Flagship',
    contextWindow: 1_000_000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    provider: 'google',
    name: 'Gemini 2.5 Flash',
    nameAr: 'جيميناي 2.5 فلاش (سرعة فائقة وذكاء استثنائي)',
    badge: 'Recommended',
    contextWindow: 1_000_000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    provider: 'google',
    name: 'Gemini 2.0 Flash',
    nameAr: 'جيميناي 2.0 فلاش (الافتراضي فائق السرعة)',
    badge: 'Fast',
    contextWindow: 1_000_000,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    provider: 'google',
    name: 'Gemini 1.5 Pro',
    nameAr: 'جيميناي 1.5 برو (سياق ضخم 2M)',
    badge: 'Flagship',
    contextWindow: 2_000_000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: false,
  },

  // --- OpenAI ---
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o (Omni)',
    nameAr: 'جي بي تي 4 أومني (متعدد الوسائط واللغات)',
    badge: 'Flagship',
    contextWindow: 128_000,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o Mini',
    nameAr: 'جي بي تي 4 أومني ميني (اقتصادي وسريع)',
    badge: 'Fast',
    contextWindow: 128_000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'VERY_GOOD',
    isPopular: true,
  },
  'o3-mini': {
    id: 'o3-mini',
    provider: 'openai',
    name: 'o3-mini (Reasoning)',
    nameAr: 'أو 3 ميني (استنتاج وتفكير منطقي)',
    badge: 'Reasoning',
    contextWindow: 200_000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'o1': {
    id: 'o1',
    provider: 'openai',
    name: 'o1 (Deep Reasoning)',
    nameAr: 'أو 1 (تفكير متعمق ومعقد)',
    badge: 'Reasoning',
    contextWindow: 200_000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 60.00,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    multilingualRating: 'EXCELLENT',
    isPopular: false,
  },

  // --- DeepSeek ---
  'deepseek-chat': {
    id: 'deepseek-chat',
    provider: 'deepseek',
    name: 'DeepSeek V3 (Chat)',
    nameAr: 'ديب سيك شات V3 (فائق السرعة واقتصادي جداً)',
    badge: 'Fast',
    contextWindow: 64_000,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    name: 'DeepSeek R1 (Reasoner)',
    nameAr: 'ديب سيك ريزنر R1 (تفكير واستنتاج مفتوح)',
    badge: 'Reasoning',
    contextWindow: 64_000,
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    supportsToolCalling: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },

  // --- OpenRouter ---
  'deepseek/deepseek-chat': {
    id: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    name: 'DeepSeek V3 (via OpenRouter)',
    nameAr: 'ديب سيك V3 (عبر أوبن راوتر)',
    badge: 'Recommended',
    contextWindow: 64_000,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'deepseek/deepseek-r1': {
    id: 'deepseek/deepseek-r1',
    provider: 'openrouter',
    name: 'DeepSeek R1 (via OpenRouter)',
    nameAr: 'ديب سيك R1 (عبر أوبن راوتر)',
    badge: 'Reasoning',
    contextWindow: 64_000,
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    supportsToolCalling: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
  'qwen/qwen-2.5-72b-instruct': {
    id: 'qwen/qwen-2.5-72b-instruct',
    provider: 'openrouter',
    name: 'Qwen 2.5 72B Instruct',
    nameAr: 'كيوين 2.5 (72B متعدد اللغات بدقة عالية)',
    badge: 'OpenSource',
    contextWindow: 128_000,
    inputCostPer1M: 0.35,
    outputCostPer1M: 0.40,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    multilingualRating: 'EXCELLENT',
    isPopular: true,
  },
};

export const PROVIDER_DEFINITIONS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'o1',
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Direct',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
    models: [
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'qwen/qwen-2.5-72b-instruct',
    ],
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['custom-model'],
  },
];

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);

  getAvailableProviders(): ProviderInfo[] {
    return PROVIDER_DEFINITIONS;
  }

  getAllModels(): ModelCapability[] {
    return Object.values(SUPPORTED_MODEL_REGISTRY);
  }

  getModelsByProvider(provider: string): ModelCapability[] {
    const prov = provider.toLowerCase();
    return Object.values(SUPPORTED_MODEL_REGISTRY).filter(
      (m) => m.provider.toLowerCase() === prov,
    );
  }

  getModelInfo(modelId: string): ModelCapability {
    if (SUPPORTED_MODEL_REGISTRY[modelId]) {
      return SUPPORTED_MODEL_REGISTRY[modelId];
    }
    // Generic fallback for custom models
    return {
      id: modelId,
      provider: 'custom',
      name: modelId,
      nameAr: modelId,
      badge: 'Recommended',
      contextWindow: 128_000,
      inputCostPer1M: 2.00,
      outputCostPer1M: 8.00,
      supportsToolCalling: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      multilingualRating: 'GOOD',
      isPopular: false,
    };
  }

  calculateCostUsd(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const model = this.getModelInfo(modelId);
    const inCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
    const outCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
    return Number((inCost + outCost).toFixed(6));
  }
}
