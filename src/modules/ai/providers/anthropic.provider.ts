import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IAiProvider, IAiCompletionOptions, IAiProviderResponse } from '../interfaces/ai-provider.interface';

@Injectable()
export class AnthropicProvider implements IAiProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  createClient(apiKey?: string): Anthropic | null {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    try {
      return new Anthropic({ apiKey: key });
    } catch (err) {
      this.logger.error(`Failed to initialize Anthropic client: ${(err as Error).message}`);
      return null;
    }
  }

  isConfigured(apiKey?: string): boolean {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    return !!key && key.length > 5;
  }

  async generateCompletion(
    prompt: string,
    options: IAiCompletionOptions = {},
    customApiKey?: string,
  ): Promise<IAiProviderResponse> {
    const client = this.createClient(customApiKey);
    if (!client) {
      throw new ServiceUnavailableException('Anthropic provider is unconfigured or key is missing.');
    }

    const model = options.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const timeoutMs = options.timeoutMs || Number(process.env.AI_REQUEST_TIMEOUT_MS) || 15_000;
    const maxTokens = options.maxTokens || Number(process.env.AI_MAX_OUTPUT_TOKENS) || 1_024;
    const temperature = options.temperature ?? 0.7;

    const startTime = Date.now();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          temperature,
          system: options.systemPrompt || 'You are a helpful travel assistant.',
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
      this.logger.error(`Anthropic API error (${latencyMs}ms): ${error?.message || error}`);
      if (error?.name === 'AbortError') {
        throw new ServiceUnavailableException('AI Provider request timed out.');
      }
      throw new ServiceUnavailableException(error?.message || 'Failed to communicate with AI provider.');
    } finally {
      clearTimeout(timer);
    }
  }
}
