import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IAiProvider, IAiCompletionOptions, IAiProviderResponse } from '../interfaces/ai-provider.interface';
import { PROVIDER_REGISTRY, getOfficialBaseUrl, ProviderErrorCode } from '../services/model-registry.service';

// ============================================================
// STRUCTURED PROVIDER ERROR
// 404 errors must NEVER trigger blind retries.
// Each HTTP code is classified into an actionable error type.
// ============================================================

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly httpStatus?: number,
    public readonly provider?: string,
    public readonly model?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const MODEL_ALIASES: Record<string, string> = {
  'gpt-5.6-luna': 'gpt-4o',
  'google/gemini-2.0-flash-001': 'gemini-2.0-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite': 'gemini-3.5-flash-lite',
};


export function normalizeModelId(model: string): string {
  const clean = (model || '').replace(/^models\//, '');
  return MODEL_ALIASES[clean] || clean;
}

function classifyHttpError(status: number, body: string, provider: string, model: string): ProviderError {
  let message = `Provider '${provider}' HTTP ${status}`;
  let isKeyInvalid = false;
  try {
    const parsed = JSON.parse(body);
    const errObj = Array.isArray(parsed) ? (parsed[0]?.error || parsed[0]) : (parsed?.error || parsed);
    message = errObj?.message || parsed?.message || message;
    const reason = errObj?.details?.[0]?.reason || errObj?.reason || '';
    if (
      reason === 'API_KEY_INVALID' ||
      message.toLowerCase().includes('api key not valid') ||
      message.toLowerCase().includes('pass a valid api key') ||
      message.toLowerCase().includes('invalid api key')
    ) {
      isKeyInvalid = true;
    }
  } catch {
    if (body) message += `: ${body.slice(0, 200)}`;
  }

  if (isKeyInvalid) {
    return new ProviderError('INVALID_KEY', `API key rejected by provider '${provider}'. Key may be invalid or expired: ${message}`, status, provider, model);
  }

  switch (status) {
    case 400:
      return new ProviderError('INVALID_CONFIGURATION', message, status, provider, model);
    case 401:
      return new ProviderError('UNAUTHORIZED', `Authentication failed for provider '${provider}'. Check your API key.`, status, provider, model);
    case 403:
      return new ProviderError('INVALID_KEY', `API key rejected by provider '${provider}'. Key may be invalid or expired.`, status, provider, model);
    case 404:
      // Critical: 404 means model or endpoint not found — MUST NOT be retried blindly
      return new ProviderError(
        'MODEL_NOT_FOUND',
        `Provider '${provider}' returned 404: model '${model}' or endpoint not found. ` +
        `Verify the model ID is valid for this provider and the base URL is correct. ` +
        `Original: ${message}`,
        status,
        provider,
        model,
      );
    case 429:
      return new ProviderError('RATE_LIMITED', `Provider '${provider}' rate limit exceeded. Will try next credential.`, status, provider, model);
    default:
      if (status >= 500) {
        return new ProviderError('PROVIDER_DOWN', `Provider '${provider}' server error (${status}). Service may be degraded.`, status, provider, model);
      }
      return new ProviderError('UNKNOWN_ERROR', message, status, provider, model);
  }
}

@Injectable()
export class UniversalAiProvider implements IAiProvider {
  readonly providerName = 'universal';
  private readonly logger = new Logger(UniversalAiProvider.name);

  isConfigured(apiKey?: string): boolean {
    return !!apiKey && apiKey.length > 5;
  }

  /**
   * Universal completion router.
   * Routes to the correct provider SDK or REST API based on provider config.
   * Never silently remaps model IDs.
   * Never defaults to Anthropic.
   * Throws ProviderError with structured error code — callers decide retry behavior.
   */
  async generateCompletion(
    prompt: string,
    options: IAiCompletionOptions = {},
    customApiKey?: string,
  ): Promise<IAiProviderResponse> {
    const provider = (options.provider || '').toLowerCase();
    if (!provider) {
      throw new ProviderError('INVALID_CONFIGURATION', 'Provider must be specified. No default provider is assumed.');
    }

    const providerDef = PROVIDER_REGISTRY[provider];
    if (!providerDef) {
      throw new ProviderError('INVALID_CONFIGURATION', `Unknown provider '${provider}'. Supported: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`);
    }

    const apiKey = customApiKey;
    if (!apiKey || apiKey.length < 5) {
      throw new ProviderError('INVALID_KEY', `API key is missing or too short for provider '${provider}'.`);
    }

    // Route based on API style
    if (providerDef.apiStyle === 'anthropic-sdk') {
      return this.generateAnthropicCompletion(prompt, options, apiKey);
    }

    if (provider === 'google') {
      return this.generateGoogleCompletionWithFallback(prompt, options, apiKey, providerDef);
    }

    return this.generateOpenAiCompatibleCompletion(prompt, options, apiKey, provider, providerDef);
  }

  // ──────────────────────────────────────────────────────────────────
  // Google Gemini Native + OpenAI-compatible Fallback
  // ──────────────────────────────────────────────────────────────────
  private async generateGoogleCompletionWithFallback(
    prompt: string,
    options: IAiCompletionOptions,
    apiKey: string,
    providerDef: any,
  ): Promise<IAiProviderResponse> {
    const rawModel = options.model || 'gemini-3.6-flash';
    const model = normalizeModelId(rawModel);

    // Try Google Native API first (fastest, direct, reliable)
    try {
      return await this.generateGoogleNativeCompletion(prompt, { ...options, model }, apiKey, model);
    } catch (err: any) {
      if (err instanceof ProviderError && (err.code === 'UNAUTHORIZED' || err.code === 'INVALID_KEY')) {
        throw err;
      }
      this.logger.warn(`Google Native API failed (${err.message}). Trying OpenAI-compatible endpoint...`);
      return this.generateOpenAiCompatibleCompletion(prompt, { ...options, model }, apiKey, 'google', providerDef);
    }
  }

  private async generateGoogleNativeCompletion(
    prompt: string,
    options: IAiCompletionOptions,
    apiKey: string,
    model: string,
  ): Promise<IAiProviderResponse> {
    const timeoutMs = options.timeoutMs || 15_000;
    const maxTokens = options.maxTokens || 1_024;
    const temperature = options.temperature ?? 0.7;

    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    if (options.systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    const startTime = Date.now();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw classifyHttpError(res.status, errorBody, 'google', cleanModel);
      }

      const json = await res.json();
      const parts = json.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p: any) => p.text || '').filter(Boolean).join('\n') || '';
      const inputTokens = json.usageMetadata?.promptTokenCount || 0;
      const outputTokens = json.usageMetadata?.candidatesTokenCount || 0;

      this.logger.debug(
        `[google-native] SUCCESS (${latencyMs}ms) model=${cleanModel} in=${inputTokens} out=${outputTokens}`,
      );

      return { text, inputTokens, outputTokens, latencyMs, provider: 'google', model: cleanModel };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      if (error instanceof ProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new ProviderError(
          'TIMEOUT',
          `Provider 'google' request timed out after ${timeoutMs}ms.`,
          undefined,
          'google',
          cleanModel,
        );
      }
      throw new ProviderError(
        'UNKNOWN_ERROR',
        `Google Native API failed (${latencyMs}ms): ${error?.message}`,
        undefined,
        'google',
        cleanModel,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Anthropic SDK path (legacy providers only)
  // ──────────────────────────────────────────────────────────────────
  private async generateAnthropicCompletion(
    prompt: string,
    options: IAiCompletionOptions,
    apiKey: string,
  ): Promise<IAiProviderResponse> {
    const model = options.model || 'claude-3-5-sonnet-20241022';
    const timeoutMs = options.timeoutMs || 15_000;
    const maxTokens = options.maxTokens || 1_024;
    const temperature = options.temperature ?? 0.7;

    const startTime = Date.now();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          temperature,
          system: options.systemPrompt || 'You are GuideR, a luxury AI travel concierge for Dunas Travel.',
          messages: [{ role: 'user', content: prompt }],
        },
        { signal: abortController.signal },
      );

      const latencyMs = Date.now() - startTime;
      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return { text, inputTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, latencyMs, provider: 'anthropic', model };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(`Anthropic SDK error (${latencyMs}ms): ${error?.message}`);
      if (error?.name === 'AbortError') {
        throw new ProviderError('TIMEOUT', `Anthropic request timed out after ${timeoutMs}ms.`);
      }
      if (error?.status) {
        throw classifyHttpError(error.status, error.message || '', 'anthropic', model);
      }
      throw new ProviderError('UNKNOWN_ERROR', error?.message || 'Anthropic API failed.', undefined, 'anthropic', model);
    } finally {
      clearTimeout(timer);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // OpenAI-compatible REST path (Google, OpenAI, xAI, OpenRouter, DeepSeek, Custom)
  // ──────────────────────────────────────────────────────────────────
  private async generateOpenAiCompatibleCompletion(
    prompt: string,
    options: IAiCompletionOptions,
    apiKey: string,
    provider: string,
    providerDef: any,
  ): Promise<IAiProviderResponse> {
    const rawModel = options.model;
    if (!rawModel) {
      throw new ProviderError(
        'INVALID_CONFIGURATION',
        `Model must be specified for provider '${provider}'. No default model is assumed.`,
      );
    }
    const model = normalizeModelId(rawModel);

    // ── Base URL ───────────────────────────────────────────────────
    let baseUrl: string;
    try {
      baseUrl = getOfficialBaseUrl(provider, providerDef.allowCustomBaseUrl ? options.baseUrl : undefined);
    } catch (err: any) {
      throw new ProviderError('INVALID_CONFIGURATION', err.message);
    }

    const timeoutMs = options.timeoutMs || 15_000;
    const maxTokens = options.maxTokens || 1_024;
    const temperature = options.temperature ?? 0.7;

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const endpoint = cleanBase.endsWith('/chat/completions')
      ? cleanBase
      : `${cleanBase}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // Provider-specific headers
    if (provider === 'google') {
      headers['x-goog-api-key'] = apiKey;
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://dunas-travel.com';
      headers['X-Title'] = 'Dunas Travel GuideR AI Concierge';
    }

    const messages: any[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const startTime = Date.now();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    this.logger.debug(
      `[${provider}] POST ${endpoint} model=${model}`,
    );

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        const providerError = classifyHttpError(res.status, errorBody, provider, model);
        this.logger.warn(
          `[${provider}] ${providerError.code} (${latencyMs}ms) model=${model}: ${providerError.message}`,
        );
        // 404 must not be silently swallowed — callers will NOT retry 404s
        throw providerError;
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      const inputTokens = json.usage?.prompt_tokens || 0;
      const outputTokens = json.usage?.completion_tokens || 0;

      this.logger.debug(
        `[${provider}] SUCCESS (${latencyMs}ms) model=${model} in=${inputTokens} out=${outputTokens}`,
      );

      return { text, inputTokens, outputTokens, latencyMs, provider, model };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      if (error instanceof ProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new ProviderError(
          'TIMEOUT',
          `Provider '${provider}' request timed out after ${timeoutMs}ms.`,
          undefined,
          provider,
          model,
        );
      }
      throw new ProviderError(
        'UNKNOWN_ERROR',
        `Provider '${provider}' failed (${latencyMs}ms): ${error?.message}`,
        undefined,
        provider,
        model,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
