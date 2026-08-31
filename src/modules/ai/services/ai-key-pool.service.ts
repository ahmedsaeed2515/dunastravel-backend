import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UniversalAiProvider, ProviderError } from '../providers/universal-ai.provider';
import { IAiCompletionOptions, IAiProviderResponse } from '../interfaces/ai-provider.interface';
import { ModelRegistryService, PROVIDER_REGISTRY, validateBaseUrl } from './model-registry.service';
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from '../../../common/security/field-encryption.util';

// ============================================================
// TYPES
// ============================================================

export interface CredentialEntry {
  id: string;
  provider: string;
  defaultModel: string;
  enabledModels: string[];
  baseUrl?: string;
  label?: string;
  priority: number;
  isActive: boolean;
  failCount: number;
  lastStatus: 'HEALTHY' | 'RATE_LIMITED' | 'FAILED' | 'UNTESTED' | 'INVALID_CREDENTIAL' | 'CONFIGURATION_ERROR';
  lastLatencyMs?: number;
  lastTestedAt?: string;
  lastUsedAt?: string;
}

export interface MaskedCredentialEntry extends Omit<CredentialEntry, 'encryptedKey'> {
  maskedKey: string;
  hasKey: boolean;
}

export interface ProviderTestResult {
  success: boolean;
  code: 'SUCCESS' | 'INVALID_KEY' | 'UNAUTHORIZED' | 'MODEL_NOT_FOUND' | 'RATE_LIMITED' | 'PROVIDER_DOWN' | 'INVALID_CONFIGURATION' | 'TIMEOUT' | 'UNKNOWN_ERROR';
  provider: string;
  model: string;
  latencyMs?: number;
  message?: string;
  error?: string;
  diagnosis?: string;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class AiKeyPoolService implements OnModuleInit {
  private readonly logger = new Logger(AiKeyPoolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly universalProvider: UniversalAiProvider,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // STARTUP: Migrate JSON blob → AiProviderCredential table & auto-sanitize legacy model IDs
  // ──────────────────────────────────────────────────────────────────
  async onModuleInit() {
    try {
      await this.migrateJsonBlobToTable();
    } catch (err: any) {
      this.logger.warn(`Startup migration check failed (non-fatal): ${err.message}`);
    }

    try {
      await this.sanitizeLegacyModelIds();
    } catch (err: any) {
      this.logger.warn(`Startup model sanitization failed (non-fatal): ${err.message}`);
    }
  }

  private async sanitizeLegacyModelIds() {
    const legacyModelMap: Record<string, string> = {
      'gemini-1.5-flash': 'gemini-3.5-flash-lite',
      'gemini-1.5-pro': 'gemini-3.6-flash',
      'gemini-1.5-flash-8b': 'gemini-3.5-flash-lite',
      'gemini-2.0-flash': 'gemini-3.6-flash',
      'gemini-2.0-flash-001': 'gemini-3.6-flash',
      'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
      'gemini-2.0-flash-lite-001': 'gemini-3.5-flash-lite',
      'gpt-5.6-luna': 'gpt-4o',
      'google/gemini-2.0-flash-001': 'gemini-3.6-flash',
    };

    for (const [legacy, current] of Object.entries(legacyModelMap)) {
      await (this.prisma as any).aiProviderCredential.updateMany({
        where: { model: legacy },
        data: { model: current },
      }).catch(() => {});
    }

    await (this.prisma as any).aiConfig.updateMany({
      where: { model: { in: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] } },
      data: { model: 'gemini-3.6-flash' },
    }).catch(() => {});
  }

  private async migrateJsonBlobToTable() {
    const existingCount = await (this.prisma as any).aiProviderCredential.count();
    if (existingCount > 0) {
      this.logger.log(`AiProviderCredential table has ${existingCount} rows — skipping JSON blob migration.`);
      return;
    }

    // Look for legacy JSON blob
    const config = await (this.prisma as any).aiConfig.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!config) return;

    const pool: any[] = (config.tourSettings as any)?.apiKeysPool || [];
    if (pool.length === 0) {
      this.logger.log('No legacy JSON blob keys found — starting fresh.');
      return;
    }

    this.logger.log(`Migrating ${pool.length} legacy JSON blob key(s) to AiProviderCredential table...`);

    for (const entry of pool) {
      try {
        await (this.prisma as any).aiProviderCredential.create({
          data: {
            provider: (entry.provider || 'google').toLowerCase(),
            model: entry.model || '',
            label: entry.label || `${entry.provider} (migrated)`,
            encryptedApiKey: entry.encryptedKey || '',
            baseUrl: entry.baseUrl || null,
            priority: entry.priority || 1,
            isActive: entry.isActive ?? true,
            failCount: entry.failCount || 0,
            lastStatus: entry.lastStatus || 'UNTESTED',
            lastLatencyMs: entry.lastLatencyMs || null,
            lastTestedAt: entry.lastTestedAt ? new Date(entry.lastTestedAt) : null,
          },
        });
        this.logger.log(`  Migrated: ${entry.label || entry.provider}/${entry.model}`);
      } catch (err: any) {
        this.logger.warn(`  Failed to migrate entry ${entry.id}: ${err.message}`);
      }
    }

    this.logger.log('JSON blob migration complete.');
  }

  // ──────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────

  private maskKey(encryptedKey: string): string {
    const key = decryptSensitiveField(encryptedKey) || '';
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••••${key.slice(-4)}`;
  }

  private toMasked(row: any): MaskedCredentialEntry {
    return {
      id: row.id,
      provider: row.provider,
      defaultModel: row.model || '',
      enabledModels: Array.isArray(row.enabledModels) ? row.enabledModels : (row.model ? [row.model] : []),
      baseUrl: row.baseUrl || undefined,
      label: row.label || undefined,
      priority: row.priority,
      isActive: row.isActive,
      failCount: row.failCount || 0,
      lastStatus: row.lastStatus as any || 'UNTESTED',
      lastLatencyMs: row.lastLatencyMs || undefined,
      lastTestedAt: row.lastTestedAt?.toISOString() || undefined,
      lastUsedAt: row.lastUsedAt?.toISOString() || undefined,
      maskedKey: this.maskKey(row.encryptedApiKey || ''),
      hasKey: Boolean(row.encryptedApiKey && row.encryptedApiKey.length > 5),
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // LEGACY: getAiConfig (still needed by ChatOrchestratorService)
  // ──────────────────────────────────────────────────────────────────

  async getAiConfig() {
    let config = await (this.prisma as any).aiConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await (this.prisma as any).aiConfig.create({
        data: {
          provider: 'google',                      // Changed from 'anthropic'
          model: 'gemini-3.6-flash',
          isEnabled: true,
          isPublicEnabled: true,
          systemInstructions: 'You are GuideR, a luxury AI travel concierge for Dunas Travel.',
          fallbackMessage: `I'd be delighted to assist you! Would you like me to connect you with our senior travel team or help you customize a private itinerary?`,
          escalationMessage: `I have notified our senior travel team. A dedicated travel specialist will contact you shortly!`,
          tourSettings: { apiKeysPool: [] },
        },
      });
    }

    return config;
  }

  // ──────────────────────────────────────────────────────────────────
  // KEY POOL CRUD — now using AiProviderCredential table
  // ──────────────────────────────────────────────────────────────────

  async getKeyPool(): Promise<MaskedCredentialEntry[]> {
    const rows = await (this.prisma as any).aiProviderCredential.findMany({
      orderBy: { priority: 'asc' },
    });
    return rows.map((r: any) => this.toMasked(r));
  }

  async addKey(dto: {
    provider: string;
    model?: string;
    apiKey: string;
    baseUrl?: string;
    label?: string;
    priority?: number;
    isActive?: boolean;
  }): Promise<MaskedCredentialEntry> {
    const providerId = dto.provider.toLowerCase();

    // Validate provider exists
    if (!PROVIDER_REGISTRY[providerId]) {
      throw new BadRequestException(`Unknown provider '${dto.provider}'. Supported: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`);
    }

    if (dto.baseUrl) {
      const urlCheck = validateBaseUrl(dto.baseUrl);
      if (!urlCheck.valid) {
        throw new BadRequestException(`Invalid base URL: ${urlCheck.reason}`);
      }
    }

    // Validate model/provider pair if a model is specified
    if (dto.model && dto.model.trim()) {
      const trimmedModel = dto.model.trim();
      const validation = this.modelRegistry.validateProviderModelPair(providerId, trimmedModel);
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid provider/model combination: ${validation.reason}`
        );
      }
    }

    const maxPriority = await (this.prisma as any).aiProviderCredential.aggregate({
      _max: { priority: true },
    });
    const nextPriority = dto.priority ?? ((maxPriority._max.priority || 0) + 1);

    const row = await (this.prisma as any).aiProviderCredential.create({
      data: {
        provider: providerId,
        model: dto.model?.trim() || '',
        label: dto.label?.trim() || `${dto.provider} Key`,
        encryptedApiKey: encryptSensitiveField(dto.apiKey.trim())!,
        baseUrl: dto.baseUrl?.trim() || null,
        priority: nextPriority,
        isActive: dto.isActive ?? true,
        failCount: 0,
        lastStatus: 'UNTESTED',
      },
    });

    this.modelRegistry.invalidateDiscoveryCache(providerId);
    return this.toMasked(row);
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
  ): Promise<MaskedCredentialEntry> {
    const existing = await (this.prisma as any).aiProviderCredential.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Credential '${id}' not found.`);

    const providerId = (dto.provider || existing.provider).toLowerCase();
    if (dto.provider && !PROVIDER_REGISTRY[providerId]) {
      throw new BadRequestException(`Unknown provider '${dto.provider}'.`);
    }

    if (dto.baseUrl) {
      const urlCheck = validateBaseUrl(dto.baseUrl);
      if (!urlCheck.valid) {
        throw new BadRequestException(`Invalid base URL: ${urlCheck.reason}`);
      }
    }

    const modelId = dto.model !== undefined ? dto.model.trim() : existing.model;
    if (modelId && dto.model !== undefined) {
      const validation = this.modelRegistry.validateProviderModelPair(providerId, modelId);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid provider/model combination: ${validation.reason}`);
      }
    }

    const updateData: any = {};
    if (dto.provider) updateData.provider = providerId;
    if (dto.model !== undefined) updateData.model = modelId;
    if (dto.label !== undefined) updateData.label = dto.label.trim();
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    // baseUrl: only update for custom providers
    if (dto.baseUrl !== undefined) {
      if (PROVIDER_REGISTRY[providerId]?.allowCustomBaseUrl) {
        updateData.baseUrl = dto.baseUrl.trim() || null;
      }
    }
    // API key: only update if a real new key is provided (not masked dots)
    if (dto.apiKey && dto.apiKey.trim().length > 5 && !dto.apiKey.includes('••')) {
      updateData.encryptedApiKey = encryptSensitiveField(dto.apiKey.trim())!;
      updateData.lastStatus = 'UNTESTED';
      updateData.failCount = 0;
    }

    const row = await (this.prisma as any).aiProviderCredential.update({
      where: { id },
      data: updateData,
    });

    this.modelRegistry.invalidateDiscoveryCache(providerId);
    return this.toMasked(row);
  }

  async deleteKey(id: string): Promise<{ success: boolean; id: string }> {
    const existing = await (this.prisma as any).aiProviderCredential.findUnique({ where: { id } });
    if (existing) {
      this.modelRegistry.invalidateDiscoveryCache(existing.provider);
    }
    await (this.prisma as any).aiProviderCredential.delete({ where: { id } }).catch(() => {});
    return { success: true, id };
  }

  async reorderKeys(orderedIds: string[]): Promise<MaskedCredentialEntry[]> {
    await Promise.all(
      orderedIds.map((id, index) =>
        (this.prisma as any).aiProviderCredential.update({
          where: { id },
          data: { priority: index + 1 },
        }).catch(() => {}),
      ),
    );
    return this.getKeyPool();
  }

  // ──────────────────────────────────────────────────────────────────
  // TEST KEY — Returns structured error codes, not just success/failed
  // ──────────────────────────────────────────────────────────────────

  async testKey(id: string): Promise<ProviderTestResult> {
    const row = await (this.prisma as any).aiProviderCredential.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Credential '${id}' not found.`);

    const apiKey = decryptSensitiveField(row.encryptedApiKey) || '';
    const providerId = row.provider;
    const modelId = row.model;

    if (!apiKey) {
      return {
        success: false,
        code: 'INVALID_KEY',
        provider: providerId,
        model: modelId,
        error: 'No API key stored for this credential.',
        diagnosis: 'Add an API key to this credential before testing.',
      };
    }

    if (!modelId) {
      return {
        success: false,
        code: 'INVALID_CONFIGURATION',
        provider: providerId,
        model: '',
        error: 'No model configured for this credential.',
        diagnosis: 'Select a model for this credential.',
      };
    }

    // Validate provider/model before making any external call
    const validation = this.modelRegistry.validateProviderModelPair(providerId, modelId);
    if (!validation.valid) {
      await (this.prisma as any).aiProviderCredential.update({
        where: { id },
        data: { lastStatus: 'CONFIGURATION_ERROR', lastTestedAt: new Date() },
      });
      return {
        success: false,
        code: 'INVALID_CONFIGURATION',
        provider: providerId,
        model: modelId,
        error: validation.reason,
        diagnosis: `This credential has a provider/model mismatch. ${validation.reason}`,
      };
    }

    const startTime = Date.now();
    try {
      const res = await this.universalProvider.generateCompletion(
        'Say "Connection verified" in exactly 2 words.',
        {
          provider: providerId,
          model: modelId,
          maxTokens: 20,
          timeoutMs: 12_000,
        },
        apiKey,
      );

      await (this.prisma as any).aiProviderCredential.update({
        where: { id },
        data: {
          lastStatus: 'HEALTHY',
          failCount: 0,
          lastLatencyMs: res.latencyMs,
          lastTestedAt: new Date(),
        },
      });

      return {
        success: true,
        code: 'SUCCESS',
        provider: providerId,
        model: modelId,
        latencyMs: res.latencyMs,
        message: res.text,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const code = err instanceof ProviderError ? err.code : 'UNKNOWN_ERROR';

      let newStatus: string;
      switch (code) {
        case 'RATE_LIMITED': newStatus = 'RATE_LIMITED'; break;
        case 'UNAUTHORIZED':
        case 'INVALID_KEY': newStatus = 'INVALID_CREDENTIAL'; break;
        case 'MODEL_NOT_FOUND':
        case 'INVALID_CONFIGURATION': newStatus = 'CONFIGURATION_ERROR'; break;
        default: newStatus = 'FAILED';
      }

      await (this.prisma as any).aiProviderCredential.update({
        where: { id },
        data: {
          lastStatus: newStatus,
          failCount: { increment: 1 },
          lastTestedAt: new Date(),
        },
      });

      let diagnosis = err.message;
      if (code === 'MODEL_NOT_FOUND') {
        diagnosis = `The model '${modelId}' was not found at provider '${providerId}'. ` +
          `Verify the model ID is correct and the provider supports it. ` +
          `DO NOT retry — this is a configuration error, not a transient failure.`;
      } else if (code === 'UNAUTHORIZED' || code === 'INVALID_KEY') {
        diagnosis = `The API key for '${providerId}' was rejected. Verify the key is correct and not expired.`;
      } else if (code === 'RATE_LIMITED') {
        diagnosis = `Provider '${providerId}' rate limit hit. Wait before retrying.`;
      }

      return {
        success: false,
        code,
        provider: providerId,
        model: modelId,
        latencyMs,
        error: err.message,
        diagnosis,
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // FAILOVER V3 — Model-route level failover with error classification
  // ──────────────────────────────────────────────────────────────────

  async executeWithFailover(
    prompt: string,
    options: IAiCompletionOptions = {},
  ): Promise<IAiProviderResponse> {
    const config = await this.getAiConfig();
    const rows = await (this.prisma as any).aiProviderCredential.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    // Build candidate list from active credentials
    const candidates = rows.map((r: any) => ({
      id: r.id,
      provider: r.provider,
      model: r.model || config.model || 'gemini-3.6-flash',
      apiKey: decryptSensitiveField(r.encryptedApiKey) || '',
    })).filter((c: any) => c.apiKey.length > 5);

    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        'No active AI credentials configured. Please add a provider credential in the AI Settings → Models & Providers tab.',
      );
    }

    let lastError: any = null;
    const skippedProviders = new Set<string>(); // For 401/403: skip entire provider

    for (const candidate of candidates) {
      // Skip providers that had auth failures
      if (skippedProviders.has(candidate.provider)) {
        this.logger.debug(`Skipping '${candidate.provider}' — auth failure earlier in failover chain.`);
        continue;
      }

      try {
        const completionOptions: IAiCompletionOptions = {
          ...options,
          provider: options.provider || candidate.provider,
          model: options.model || candidate.model,
          temperature: options.temperature ?? config.temperature,
          maxTokens: options.maxTokens ?? config.maxTokens,
          timeoutMs: options.timeoutMs ?? config.requestTimeoutMs,
        };

        const response = await this.universalProvider.generateCompletion(
          prompt,
          completionOptions,
          candidate.apiKey,
        );

        // Update health metrics async
        (this.prisma as any).aiProviderCredential.update({
          where: { id: candidate.id },
          data: {
            lastStatus: 'HEALTHY',
            failCount: 0,
            lastLatencyMs: response.latencyMs,
            lastUsedAt: new Date(),
          },
        }).catch((e: any) => this.logger.warn(`Async telemetry update failed: ${e.message}`));

        return response;
      } catch (err: any) {
        lastError = err;
        const code = err instanceof ProviderError ? err.code : 'UNKNOWN_ERROR';

        this.logger.warn(
          `Failover: candidate '${candidate.provider}/${candidate.model}' failed with ${code}: ${err.message}`,
        );

        // Determine failover behavior based on error type
        let newStatus = 'FAILED';
        let shouldSkipProvider = false;

        if (code === 'RATE_LIMITED') {
          newStatus = 'RATE_LIMITED';
          // Try next key for same provider
        } else if (code === 'UNAUTHORIZED' || code === 'INVALID_KEY') {
          newStatus = 'INVALID_CREDENTIAL';
          skippedProviders.add(candidate.provider); // Skip ALL keys for this provider
          shouldSkipProvider = true;
        } else if (code === 'MODEL_NOT_FOUND' || code === 'INVALID_CONFIGURATION') {
          newStatus = 'CONFIGURATION_ERROR';
          // Don't retry this specific model — but could try another credential
        } else if (code === 'TIMEOUT' || code === 'PROVIDER_DOWN') {
          newStatus = 'FAILED';
          // Try next candidate
        }

        (this.prisma as any).aiProviderCredential.update({
          where: { id: candidate.id },
          data: {
            lastStatus: newStatus,
            failCount: { increment: 1 },
          },
        }).catch((e: any) => this.logger.warn(`Async status update failed: ${e.message}`));

        if (shouldSkipProvider) {
          this.logger.warn(`Auth failure for provider '${candidate.provider}' — skipping all remaining keys for this provider.`);
        }
      }
    }

    const lastCode = lastError instanceof ProviderError ? lastError.code : 'UNKNOWN_ERROR';
    throw new ServiceUnavailableException(
      `All AI credentials failed. Last error: [${lastCode}] ${lastError?.message || 'Unknown error'}. ` +
      `Check the Models & Providers tab to verify your credentials are healthy.`,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // LEGACY: getRawKeyPool (for backwards compat with ChatOrchestratorService)
  // ──────────────────────────────────────────────────────────────────

  async getRawKeyPool(): Promise<{ configId: string; pool: any[] }> {
    const config = await this.getAiConfig();
    const rows = await (this.prisma as any).aiProviderCredential.findMany({
      orderBy: { priority: 'asc' },
    });
    return {
      configId: config.id,
      pool: rows.map((r: any) => ({
        id: r.id,
        provider: r.provider,
        model: r.model,
        baseUrl: r.baseUrl,
        encryptedKey: r.encryptedApiKey,
        label: r.label,
        priority: r.priority,
        isActive: r.isActive,
        failCount: r.failCount,
        lastStatus: r.lastStatus,
        lastLatencyMs: r.lastLatencyMs,
        lastTestedAt: r.lastTestedAt?.toISOString(),
        lastUsedAt: r.lastUsedAt?.toISOString(),
      })),
    };
  }

  private async savePool(_pool: any[]) {
    // No-op: pool is now in the proper table, not a JSON blob.
    // This stub exists for any legacy callers.
  }
}
