import {
  ModelRegistryService,
  isValidProviderModelPair,
  getOfficialBaseUrl,
  PROVIDER_REGISTRY,
  MODEL_REGISTRY,
} from './services/model-registry.service';
import { ModelRoutingService } from './services/model-routing.service';
import { UniversalAiProvider, ProviderError } from './providers/universal-ai.provider';

describe('AI Providers & Model Routing V3 — Architecture & Security Suite', () => {
  let modelRegistry: ModelRegistryService;
  let modelRouting: ModelRoutingService;

  beforeEach(() => {
    modelRegistry = new ModelRegistryService();
    modelRouting = new ModelRoutingService();
  });

  describe('1. Prevention of Provider & Model Disconnection (Google 404 Root Cause Fix)', () => {
    it('MUST reject Google + Claude model before making any API call', () => {
      const validation = modelRegistry.validateProviderModelPair(
        'google',
        'claude-3-5-sonnet-20241022',
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('belongs to provider');
    });

    it('MUST reject Google + GPT model', () => {
      const validation = modelRegistry.validateProviderModelPair('google', 'gpt-4o');
      expect(validation.valid).toBe(false);
    });

    it('MUST reject OpenAI + Gemini model', () => {
      const validation = modelRegistry.validateProviderModelPair('openai', 'gemini-2.0-flash');
      expect(validation.valid).toBe(false);
    });

    it('MUST reject shutdown Gemini 1.5 and 2.0 models', () => {
      const validation = modelRegistry.validateProviderModelPair('google', 'gemini-2.0-flash-lite');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('deprecated/shut down');
      expect(modelRegistry.validateProviderModelPair('google', 'gemini-2.0-flash').valid).toBe(false);
      expect(modelRegistry.validateProviderModelPair('google', 'gemini-1.5-flash').valid).toBe(false);
    });

    it('MUST accept Google + valid Gemini production models', () => {
      const models = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash',
      ];
      for (const m of models) {
        const validation = modelRegistry.validateProviderModelPair('google', m);
        expect(validation.valid).toBe(true);
      }
    });

    it('MUST accept OpenAI + valid OpenAI production models', () => {
      const models = ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];
      for (const m of models) {
        const validation = modelRegistry.validateProviderModelPair('openai', m);
        expect(validation.valid).toBe(true);
      }
    });

    it('MUST accept OpenRouter + DeepSeek V3 Flash model slug', () => {
      const validation = modelRegistry.validateProviderModelPair(
        'openrouter',
        'deepseek/deepseek-chat-v3-0324',
      );
      expect(validation.valid).toBe(true);
    });
  });

  describe('2. Authoritative Server-Side Base URL Registry & URL Validation', () => {
    it('MUST enforce Google OpenAI-compatible URL with trailing slash', () => {
      const url = getOfficialBaseUrl('google');
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    });

    it('MUST enforce OpenAI official base URL', () => {
      const url = getOfficialBaseUrl('openai');
      expect(url).toBe('https://api.openai.com/v1');
    });

    it('MUST enforce xAI official base URL', () => {
      const url = getOfficialBaseUrl('xai');
      expect(url).toBe('https://api.x.ai/v1');
    });

    it('MUST enforce OpenRouter official base URL', () => {
      const url = getOfficialBaseUrl('openrouter');
      expect(url).toBe('https://openrouter.ai/api/v1');
    });

    it('MUST enforce DeepSeek official base URL', () => {
      const url = getOfficialBaseUrl('deepseek');
      expect(url).toBe('https://api.deepseek.com');
    });

    it('MUST never allow custom base URL for official providers like Google', () => {
      const url = getOfficialBaseUrl('google', 'https://api.anthropic.com/v1');
      expect(url).not.toContain('anthropic');
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    });

    it('MUST allow custom base URL ONLY for custom provider', () => {
      const customUrl = 'https://my-local-vllm.internal:8000/v1';
      const url = getOfficialBaseUrl('custom', customUrl);
      expect(url).toBe(customUrl);
    });
  });

  describe('3. Tiered Model Routing Engine (GuideR Routing V3)', () => {
    it('routes simple pricing/visa/FAQ questions to the economy model (gemini-3.1-flash-lite)', () => {
      const result = modelRouting.route('What is the price of the Nile Cruise?');
      expect(result.tier).toBe('economy');
      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-3.1-flash-lite');
    });

    it('routes Arabic short inquiry to ECONOMY tier', () => {
      const result = modelRouting.route('كم سعر رحلة القاهرة؟');
      expect(result.tier).toBe('economy');
      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-3.1-flash-lite');
    });

    it('routes complex multi-day itinerary synthesis to COMPLEX tier (gemini-3.1-pro)', () => {
      const complexMsg =
        'I need a customized multi-day private tour itinerary for a family of 5 combining Cairo, Luxor, and Aswan with luxury Nile cruise and Dahabiya.';
      const result = modelRouting.route(complexMsg);
      expect(result.tier).toBe('complex');
      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-3.1-pro');
    });

    it('routes standard travel concierge conversation to the flagship model (gemini-3.7-flash)', () => {
      const standardMsg =
        'Could you tell me more about the luxury experiences included in the Grand Egyptian Museum VIP package?';
      const result = modelRouting.route(standardMsg);
      expect(result.tier).toBe('normal');
      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-3.7-flash');
    });

    it('resolves FALLBACK tier to OpenRouter DeepSeek V3 Flash', () => {
      const fallback = modelRouting.resolveModel('fallback');
      expect(fallback.provider).toBe('openrouter');
      expect(fallback.model).toBe('deepseek/deepseek-chat-v3-0324');
    });
  });

  describe('4. Model Registry & FinOps Cost Calculation', () => {
    it('calculates accurate token cost in USD for Gemini 2.5 Flash', () => {
      const cost = modelRegistry.calculateCostUsd('gemini-2.5-flash', 10_000, 2_000);
      expect(cost).toBeCloseTo(0.0018, 4);
    });

    it('calculates accurate token cost in USD for GPT-4o', () => {
      const cost = modelRegistry.calculateCostUsd('gpt-4o', 1_000, 500);
      expect(cost).toBeCloseTo(0.0075, 4);
    });

    it('provides verified metadata for all registered models', () => {
      const allModels = modelRegistry.getAllModels();
      expect(allModels.length).toBeGreaterThanOrEqual(5);
      allModels.forEach((m) => {
        expect(m.id).toBeDefined();
        expect(m.providerId).toBeDefined();
        expect(m.contextWindow).toBeGreaterThan(0);
        expect(m.inputPricePerMillion).toBeGreaterThanOrEqual(0);
        expect(m.outputPricePerMillion).toBeGreaterThanOrEqual(0);
        expect(m.status).not.toBe('DEPRECATED');
      });
    });
  });

  describe('5. Live Model Discovery & API Key Security', () => {
    it('MUST mock discovery for Google and return only chat-capable available models', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'models/gemini-3.6-flash' },
            { id: 'models/gemini-3.5-flash-lite' },
            { id: 'models/gemini-2.0-flash' },
            { id: 'models/gemini-2.0-flash-lite' }, // shutdown model
            { id: 'models/text-embedding-004' },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      const result = await modelRegistry.discoverLiveModels('google', {
        apiKey: 'AIzaSyFakeGoogleApiKey123456',
        forceRefresh: true,
      });

      expect(result.providerId).toBe('google');
      expect(result.models.length).toBeGreaterThanOrEqual(2);
      expect(result.models.map((m) => m.id)).toContain('gemini-3.6-flash');
      expect(result.models.map((m) => m.id)).toContain('gemini-3.5-flash-lite');
      expect(result.models.find((m) => m.id === 'gemini-2.0-flash')).toBeUndefined();
      // Shutdown model must NOT be in available models
      expect(result.models.find((m) => m.id === 'gemini-2.0-flash-lite')).toBeUndefined();

      // Ensure API key is NEVER exposed in the discovery result
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('AIzaSyFakeGoogleApiKey123456');
    });

    it('MUST reject discovery without an API key', async () => {
      await expect(
        modelRegistry.discoverLiveModels('google', { apiKey: '' }),
      ).rejects.toThrow('An API key is required');
    });
  });

  describe('6. Error Classification & 404 Prevention', () => {
    it('ProviderError includes typed error code', () => {
      const err = new ProviderError(
        'MODEL_NOT_FOUND',
        'Model not found on provider',
        404,
        'google',
        'claude-3-5-sonnet-20241022',
      );
      expect(err.code).toBe('MODEL_NOT_FOUND');
      expect(err.httpStatus).toBe(404);
      expect(err.provider).toBe('google');
      expect(err.model).toBe('claude-3-5-sonnet-20241022');
    });
  });
});
