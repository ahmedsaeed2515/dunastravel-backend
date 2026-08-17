import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IAiProvider, IAiCompletionOptions, IAiProviderResponse } from '../interfaces/ai-provider.interface';

export interface ProviderEndpointConfig {
  provider: string;
  defaultBaseUrl: string;
  defaultModel: string;
}

export const PROVIDER_DEFAULTS: Record<string, ProviderEndpointConfig> = {
  anthropic: {
    provider: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  openai: {
    provider: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  google: {
    provider: 'google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
  },
  openrouter: {
    provider: 'openrouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
  },
  deepseek: {
    provider: 'deepseek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  custom: {
    provider: 'custom',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
};

@Injectable()
export class UniversalAiProvider implements IAiProvider {
  readonly providerName = 'universal';
  private readonly logger = new Logger(UniversalAiProvider.name);

  isConfigured(apiKey?: string): boolean {
    return !!apiKey && apiKey.length > 5;
  }

  /**
   * Universal completion router that handles Anthropic SDK, OpenAI-compatible REST endpoints,
   * OpenRouter, DeepSeek, Google Gemini, and custom OpenAI-compatible proxies.
   */
  async generateCompletion(
    prompt: string,
    options: IAiCompletionOptions = {},
    customApiKey?: string,
  ): Promise<IAiProviderResponse> {
    const provider = (options.provider || 'anthropic').toLowerCase();
    const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException(`API key is missing for AI provider '${provider}'.`);
    }

    if (provider === 'anthropic') {
      return this.generateAnthropicCompletion(prompt, options, apiKey);
    }

    return this.generateOpenAiCompatibleCompletion(prompt, options, apiKey, provider);
  }

  /**
   * Anthropic Claude execution via SDK
   */
  private async generateAnthropicCompletion(
    prompt: string,
    options: IAiCompletionOptions,
    apiKey: string,
  ): Promise<IAiProviderResponse> {
    const model = options.model || PROVIDER_DEFAULTS.anthropic.defaultModel;
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

      return {
        text,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        latencyMs,
        provider: 'anthropic',
        model,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(`Anthropic API call failed after ${latencyMs}ms: ${error?.message}`);
      if (error?.name === 'AbortError') {
        throw new ServiceUnavailableException('Anthropic API request timed out.');
      }
      throw new ServiceUnavailableException(error?.message || 'Anthropic API failed.');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Unified OpenAI-compatible REST execution for OpenAI, OpenRouter, DeepSeek, Google Gemini, and Custom LLMs
   */
  private async generateOpenAiCompatibleCompletion(
    prompt: string,
    options: IAiCompletionOptions,
    apiKey: string,
    provider: string,
  ): Promise<IAiProviderResponse> {
    const config = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom;
    let baseUrl = (options.baseUrl || config.defaultBaseUrl).replace(/\/+$/, '');
    const model = options.model || config.defaultModel;
    const timeoutMs = options.timeoutMs || 15_000;
    const maxTokens = options.maxTokens || 1_024;
    const temperature = options.temperature ?? 0.7;

    // Ensure endpoint URL ends with /chat/completions
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://dunas-travel.com';
      headers['X-Title'] = 'Dunas Travel GuideR AI Concierge';
    }

    const messages = [];
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
        let errMsg = `Provider '${provider}' HTTP ${res.status}: ${res.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          errMsg = parsed.error?.message || parsed.message || errMsg;
        } catch {
          if (errorBody) errMsg += ` - ${errorBody.slice(0, 150)}`;
        }
        this.logger.warn(`Universal AI Provider error (${latencyMs}ms): ${errMsg}`);
        throw new ServiceUnavailableException(errMsg);
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      const inputTokens = json.usage?.prompt_tokens || 0;
      const outputTokens = json.usage?.completion_tokens || 0;

      return {
        text,
        inputTokens,
        outputTokens,
        latencyMs,
        provider,
        model,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      if (error?.name === 'AbortError') {
        throw new ServiceUnavailableException(`AI Provider '${provider}' request timed out after ${timeoutMs}ms.`);
      }
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(`AI Provider '${provider}' failed (${latencyMs}ms): ${error?.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
