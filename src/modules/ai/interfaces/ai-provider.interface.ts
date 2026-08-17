export interface IAiCompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
  provider?: string;
  baseUrl?: string;
}

export interface IAiProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  provider: string;
  model: string;
}

export interface IAiProvider {
  readonly providerName: string;
  isConfigured(apiKey?: string): boolean;
  generateCompletion(
    prompt: string,
    options?: IAiCompletionOptions,
    customApiKey?: string,
  ): Promise<IAiProviderResponse>;
}
