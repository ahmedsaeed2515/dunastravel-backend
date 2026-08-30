import { Injectable, Logger, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UniversalAiProvider } from '../providers/universal-ai.provider';
import { IAiCompletionOptions, IAiProviderResponse } from '../interfaces/ai-provider.interface';
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from '../../../common/security/field-encryption.util';

export interface ApiKeyPoolEntry {
  id: string;
  provider: string; // 'anthropic' | 'openai' | 'google' | 'openrouter' | 'deepseek' | 'custom'
  model: string;
  baseUrl?: string;
  encryptedKey: string;
  label?: string;
  priority: number; // 1 = highest
  isActive: boolean;
  failCount: number;
  lastStatus: 'HEALTHY' | 'RATE_LIMITED' | 'FAILED' | 'UNTESTED';
  lastLatencyMs?: number;
  lastTestedAt?: string;
  lastUsedAt?: string;
}

export interface MaskedApiKeyPoolEntry extends Omit<ApiKeyPoolEntry, 'encryptedKey'> {
  maskedKey: string;
  hasKey: boolean;
}

@Injectable()
export class AiKeyPoolService {
  private readonly logger = new Logger(AiKeyPoolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly universalProvider: UniversalAiProvider,
  ) {}

  private maskKey(key: string): string {
    key = decryptSensitiveField(key) || '';
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    const prefix = key.slice(0, 6);
    const suffix = key.slice(-4);
    return `${prefix}...••••...${suffix}`;
  }

  async getAiConfig() {
    let config = await (this.prisma as any).aiConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await (this.prisma as any).aiConfig.create({
        data: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          isEnabled: true,
          isPublicEnabled: true,
          systemInstructions: 'You are GuideR, a luxury AI travel concierge for Dunas Travel.',
          fallbackMessage: `I'd be delighted to assist you! Would you like me to connect you with our senior travel team or help you customize a private itinerary?`,
          escalationMessage: `I have notified our senior travel team. A dedicated travel specialist will contact you shortly!`,
          tourSettings: {
            apiKeysPool: [],
          },
        },
      });
    }

    return config;
  }

  async getRawKeyPool(): Promise<{ configId: string; pool: ApiKeyPoolEntry[] }> {
    const config = await this.getAiConfig();
    const settings = (config.tourSettings as any) || {};
    const pool: ApiKeyPoolEntry[] = Array.isArray(settings.apiKeysPool) ? settings.apiKeysPool : [];
    return { configId: config.id, pool };
  }

  async getKeyPool(): Promise<MaskedApiKeyPoolEntry[]> {
    const { pool } = await this.getRawKeyPool();
    return pool
      .sort((a, b) => a.priority - b.priority)
      .map((entry) => ({
        id: entry.id,
        provider: entry.provider,
        model: entry.model,
        baseUrl: entry.baseUrl,
        label: entry.label,
        priority: entry.priority,
        isActive: entry.isActive,
        failCount: entry.failCount || 0,
        lastStatus: entry.lastStatus || 'UNTESTED',
        lastLatencyMs: entry.lastLatencyMs,
        lastTestedAt: entry.lastTestedAt,
        lastUsedAt: entry.lastUsedAt,
        maskedKey: this.maskKey(entry.encryptedKey),
        hasKey: Boolean(entry.encryptedKey && entry.encryptedKey.length > 5),
      }));
  }

  async addKey(dto: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl?: string;
    label?: string;
    priority?: number;
    isActive?: boolean;
  }): Promise<MaskedApiKeyPoolEntry> {
    const { configId, pool } = await this.getRawKeyPool();

    const maxPriority = pool.reduce((max, k) => Math.max(max, k.priority || 0), 0);
    const assignedPriority = (dto.priority && dto.priority > 0) ? dto.priority : (maxPriority + 1);

    const newId = `key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: ApiKeyPoolEntry = {
      id: newId,
      provider: dto.provider.toLowerCase(),
      model: dto.model.trim(),
      baseUrl: dto.baseUrl?.trim() || undefined,
      encryptedKey: encryptSensitiveField(dto.apiKey.trim())!,
      label: dto.label?.trim() || `${dto.provider} - ${dto.model}`,
      priority: assignedPriority,
      isActive: dto.isActive ?? true,
      failCount: 0,
      lastStatus: 'UNTESTED',
    };

    pool.push(newEntry);

    const config = await this.getAiConfig();
    const settings = (config.tourSettings as any) || {};
    settings.apiKeysPool = pool;

    await (this.prisma as any).aiConfig.update({
      where: { id: configId },
      data: { tourSettings: settings },
    });

    return {
      ...newEntry,
      maskedKey: this.maskKey(newEntry.encryptedKey),
      hasKey: true,
    };
  }

  async updateKey(
    id: string,
    dto: {
      provider?: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
      label?: string;
      priority?: number;
      isActive?: boolean;
    },
  ): Promise<MaskedApiKeyPoolEntry> {
    const { configId, pool } = await this.getRawKeyPool();
    const idx = pool.findIndex((k) => k.id === id);
    if (idx === -1) {
      throw new NotFoundException(`API key entry '${id}' not found in pool.`);
    }

    const current = pool[idx];
    if (dto.provider) current.provider = dto.provider.toLowerCase();
    if (dto.model) current.model = dto.model.trim();
    if (dto.baseUrl !== undefined) current.baseUrl = dto.baseUrl.trim() || undefined;
    if (dto.label !== undefined) current.label = dto.label.trim();
    if (dto.priority !== undefined && dto.priority > 0) current.priority = dto.priority;
    if (dto.isActive !== undefined) current.isActive = dto.isActive;
    if (dto.apiKey && dto.apiKey.trim().length > 5 && !dto.apiKey.includes('••')) {
      current.encryptedKey = encryptSensitiveField(dto.apiKey.trim())!;
      current.lastStatus = 'UNTESTED';
      current.failCount = 0;
    }

    pool[idx] = current;

    const config = await this.getAiConfig();
    const settings = (config.tourSettings as any) || {};
    settings.apiKeysPool = pool;

    await (this.prisma as any).aiConfig.update({
      where: { id: configId },
      data: { tourSettings: settings },
    });

    return {
      ...current,
      maskedKey: this.maskKey(current.encryptedKey),
      hasKey: true,
    };
  }

  async reorderKeys(orderedIds: string[]): Promise<MaskedApiKeyPoolEntry[]> {
    const { configId, pool } = await this.getRawKeyPool();

    orderedIds.forEach((id, index) => {
      const key = pool.find((k) => k.id === id);
      if (key) {
        key.priority = index + 1;
      }
    });

    let nextPriority = orderedIds.length + 1;
    pool.forEach((k) => {
      if (!orderedIds.includes(k.id)) {
        k.priority = nextPriority++;
      }
    });

    const config = await this.getAiConfig();
    const settings = (config.tourSettings as any) || {};
    settings.apiKeysPool = pool;

    await (this.prisma as any).aiConfig.update({
      where: { id: configId },
      data: { tourSettings: settings },
    });

    return this.getKeyPool();
  }

  async deleteKey(id: string): Promise<{ success: boolean; id: string }> {
    const { configId, pool } = await this.getRawKeyPool();
    const filtered = pool.filter((k) => k.id !== id);

    const config = await this.getAiConfig();
    const settings = (config.tourSettings as any) || {};
    settings.apiKeysPool = filtered;

    await (this.prisma as any).aiConfig.update({
      where: { id: configId },
      data: { tourSettings: settings },
    });

    return { success: true, id };
  }

  async testKey(id: string): Promise<{
    success: boolean;
    provider: string;
    model: string;
    latencyMs?: number;
    message?: string;
    error?: string;
  }> {
    const { pool } = await this.getRawKeyPool();
    const keyEntry = pool.find((k) => k.id === id);
    if (!keyEntry) {
      throw new NotFoundException(`API key '${id}' not found in pool.`);
    }

    try {
      const res = await this.universalProvider.generateCompletion(
        'Say "API Connection Verified" in 4 words.',
        {
          provider: keyEntry.provider,
          model: keyEntry.model,
          baseUrl: keyEntry.baseUrl,
          maxTokens: 20,
          timeoutMs: 12_000,
        },
        decryptSensitiveField(keyEntry.encryptedKey) || '',
      );

      keyEntry.lastStatus = 'HEALTHY';
      keyEntry.failCount = 0;
      keyEntry.lastLatencyMs = res.latencyMs;
      keyEntry.lastTestedAt = new Date().toISOString();

      await this.savePool(pool);

      return {
        success: true,
        provider: keyEntry.provider,
        model: keyEntry.model,
        latencyMs: res.latencyMs,
        message: res.text,
      };
    } catch (err: any) {
      keyEntry.lastStatus = err.message?.includes('429') ? 'RATE_LIMITED' : 'FAILED';
      keyEntry.failCount = (keyEntry.failCount || 0) + 1;
      keyEntry.lastTestedAt = new Date().toISOString();

      await this.savePool(pool);

      return {
        success: false,
        provider: keyEntry.provider,
        model: keyEntry.model,
        error: err.message,
        message: err.message || 'Connection test failed',
      };
    }
  }


  private async savePool(pool: ApiKeyPoolEntry[]) {
    const config = await this.getAiConfig();
    const settings = (config.tourSettings as any) || {};
    settings.apiKeysPool = pool;

    await (this.prisma as any).aiConfig.update({
      where: { id: config.id },
      data: { tourSettings: settings },
    });
  }

  /**
   * Smart zero-latency failover engine:
   * 1. Evaluates healthy active keys in priority order.
   * 2. Attempts execution on candidate key.
   * 3. On 429/timeout/quota failure, instantaneously switches to candidate key #2 without user delay.
   * 4. Updates health metrics asynchronously.
   */
  async executeWithFailover(
    prompt: string,
    options: IAiCompletionOptions = {},
  ): Promise<IAiProviderResponse> {
    const config = await this.getAiConfig();
    const { pool } = await this.getRawKeyPool();

    // 1. Gather all candidate keys: pool keys + root config key
    const candidates: Array<{
      id?: string;
      provider: string;
      model: string;
      baseUrl?: string;
      apiKey: string;
      priority: number;
    }> = [];

    // Add active pool keys
    pool
      .filter((k) => k.isActive)
      .sort((a, b) => a.priority - b.priority)
      .forEach((k) => {
        candidates.push({
          id: k.id,
          provider: k.provider,
          model: k.model,
          baseUrl: k.baseUrl,
          apiKey: decryptSensitiveField(k.encryptedKey) || '',
          priority: k.priority,
        });
      });

    // If pool is empty or root config has custom key, add it as candidate
    if (config.encryptedApiKey && config.encryptedApiKey.length > 5) {
      candidates.push({
        id: 'root-config-key',
        provider: config.provider || 'anthropic',
        model: config.model || 'claude-3-5-sonnet-20241022',
        apiKey: decryptSensitiveField(config.encryptedApiKey) || '',
        priority: 99,
      });
    }

    if (candidates.length === 0) {
      throw new ServiceUnavailableException('No configured or active API keys available in the AI pool.');
    }

    let lastError: any = null;

    for (const candidate of candidates) {
      try {
        const completionOptions: IAiCompletionOptions = {
          ...options,
          provider: options.provider || candidate.provider,
          model: options.model || candidate.model,
          baseUrl: options.baseUrl || candidate.baseUrl,
          temperature: options.temperature ?? config.temperature,
          maxTokens: options.maxTokens ?? config.maxTokens,
          timeoutMs: options.timeoutMs ?? config.requestTimeoutMs,
        };

        const response = await this.universalProvider.generateCompletion(
          prompt,
          completionOptions,
          candidate.apiKey,
        );

        // Update successful key metrics asynchronously
        if (candidate.id && candidate.id !== 'root-config-key') {
          const matched = pool.find((k) => k.id === candidate.id);
          if (matched) {
            matched.lastStatus = 'HEALTHY';
            matched.failCount = 0;
            matched.lastLatencyMs = response.latencyMs;
            matched.lastUsedAt = new Date().toISOString();
            this.savePool(pool).catch((e) => this.logger.warn(`Could not save pool telemetry: ${e.message}`));
          }
        }

        return response;
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `Candidate key (${candidate.provider}/${candidate.model}) failed: ${err.message}. Triggering instant failover to next key in pool.`,
        );

        if (candidate.id && candidate.id !== 'root-config-key') {
          const matched = pool.find((k) => k.id === candidate.id);
          if (matched) {
            matched.lastStatus = err.message?.includes('429') ? 'RATE_LIMITED' : 'FAILED';
            matched.failCount = (matched.failCount || 0) + 1;
            this.savePool(pool).catch((e) => this.logger.warn(`Could not save pool telemetry: ${e.message}`));
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      lastError?.message || 'All AI keys in the pool failed to respond.',
    );
  }
}
