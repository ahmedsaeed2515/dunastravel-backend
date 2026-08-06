export interface IAiCompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
}

export interface IAiProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface IAiProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  generateCompletion(
    prompt: string,
    options?: IAiCompletionOptions,
  ): Promise<IAiProviderResponse>;
}
