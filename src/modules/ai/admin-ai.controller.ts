import { Controller, Get, Put, Post, Delete, Body, Param, Query, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { UniversalAiProvider, ProviderError } from './providers/universal-ai.provider';
import { AiKeyPoolService } from './services/ai-key-pool.service';
import { AgentRegistryService, CreateAgentDto, UpdateAgentDto } from './services/agent-registry.service';
import { ModelRegistryService, PROVIDER_REGISTRY } from './services/model-registry.service';
import { ModelRoutingService } from './services/model-routing.service';
import { PromptEngineService } from './services/prompt-engine.service';
import { HybridRagEngineService } from './services/hybrid-rag-engine.service';
import {
  UpdateAiConfigDto,
  TestProviderConnectionDto,
  AddProviderCredentialDto,
  UpdateProviderCredentialDto,
  GenerateAiItineraryDto,
  RefreshProviderModelsDto,
  UpdateGuiderStatusDto,
} from './dto/admin-ai.dto';
import { SendChatMessageDto } from './dto/public-chat.dto';
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from '../../common/security/field-encryption.util';

@ApiTags('Admin - AI Command Center')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminAiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatOrchestrator: ChatOrchestratorService,
    private readonly universalProvider: UniversalAiProvider,
    private readonly keyPoolService: AiKeyPoolService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly modelRouting: ModelRoutingService,
    private readonly promptEngine: PromptEngineService,
    private readonly hybridRagEngine: HybridRagEngineService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get AI telemetry metrics and performance summary' })
  async getOverview() {
    const [
      totalConversations,
      activeConversations,
      handedOffConversations,
      qualifiedLeads,
      totalUsageLogs,
      knowledgeCount,
      toursCount,
      hotelsCount,
      keyPool,
      config,
      availability,
    ] = await Promise.all([
      this.prisma.chatConversation.count(),
      this.prisma.chatConversation.count({ where: { status: 'ACTIVE' } }),
      this.prisma.chatConversation.count({ where: { status: 'HANDED_OFF' } }),
      this.prisma.chatConversation.count({ where: { leadStatus: 'QUALIFIED' } }),
      this.prisma.aiUsageLog.aggregate({
        _sum: { inputTokens: true, outputTokens: true, latencyMs: true, estimatedCostUsd: true },
        _count: { id: true },
      }),
      this.prisma.knowledgeBaseItem.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.tour.count().catch(() => 0),
      this.prisma.hotel.count().catch(() => 0),
      this.keyPoolService.getKeyPool(),
      this.chatOrchestrator.getOrCreateConfig(),
      this.chatOrchestrator.getPublicAvailabilityStatus(),
    ]);

    const totalLogs = totalUsageLogs._count.id || 1;
    const avgLatencyMs = Math.round((totalUsageLogs._sum.latencyMs || 0) / totalLogs) || 550;
    const totalInputTokens = totalUsageLogs._sum.inputTokens || 0;
    const totalOutputTokens = totalUsageLogs._sum.outputTokens || 0;
    const estimatedCostUsd = Number(totalUsageLogs._sum.estimatedCostUsd || ((totalInputTokens * 0.3 + totalOutputTokens * 2.5) / 1_000_000).toFixed(4));
    const activeProvider = (config.provider && config.provider !== 'anthropic') ? config.provider : 'google';
    const activeModel = config.model || 'gemini-3.6-flash';

    const verifiedHealthyCount = keyPool.filter((k) => k.lastStatus === 'HEALTHY').length;
    // If any keys failed or were tested, healthy count should strictly reflect HEALTHY keys
    const healthyCount = verifiedHealthyCount;

    return {
      metrics: {
        totalConversations,
        activeConversations,
        handedOffConversations,
        qualifiedLeads,
        publishedKnowledgeArticles: knowledgeCount,
        catalogItemsCount: (knowledgeCount || 0) + (toursCount || 0) + (hotelsCount || 0),
        totalTours: toursCount,
        totalHotels: hotelsCount,
        configuredApiKeysCount: keyPool.length,
        healthyApiKeysCount: healthyCount,
        verifiedHealthyApiKeysCount: verifiedHealthyCount,
        avgLatencyMs,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCostUsd,
        activeProvider,
        activeModel,
        guiderStatus: availability.status,
        guiderAvailability: availability,
      },
    };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get detailed AI analytics, conversion funnels, FinOps cost, and latency' })
  async getAnalytics() {
    return this.chatOrchestrator.getDetailedAnalytics();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get AI chatbot configuration' })
  async getConfig() {
    const config = await this.chatOrchestrator.getOrCreateConfig();
    const tourSettings = (config.tourSettings as any) || {};
    return {
      ...config,
      isInChatBookingEnabled: tourSettings.isInChatBookingEnabled !== false,
      encryptedApiKey: config.encryptedApiKey ? '••••••••••••••••' : null,
    };
  }

  @Put('config')
  @ApiOperation({ summary: 'Update AI chatbot configuration' })
  async updateConfig(@Body() dto: UpdateAiConfigDto) {
    const currentConfig = await this.chatOrchestrator.getOrCreateConfig();
    const tourSettings = { ...((currentConfig.tourSettings as any) || {}) };

    if (dto.isInChatBookingEnabled !== undefined) {
      tourSettings.isInChatBookingEnabled = dto.isInChatBookingEnabled;
    }

    const dataToUpdate: any = {
      provider: dto.provider ?? currentConfig.provider,
      model: dto.model ?? currentConfig.model,
      isEnabled: dto.isEnabled ?? currentConfig.isEnabled,
      isPublicEnabled: dto.isPublicEnabled ?? currentConfig.isPublicEnabled,
      temperature: dto.temperature ?? currentConfig.temperature,
      maxTokens: dto.maxTokens ?? currentConfig.maxTokens,
      requestTimeoutMs: dto.requestTimeoutMs ?? currentConfig.requestTimeoutMs,
      systemInstructions: dto.systemInstructions ?? currentConfig.systemInstructions,
      salesPersonality: dto.salesPersonality ?? currentConfig.salesPersonality,
      toneOfVoice: dto.toneOfVoice ?? currentConfig.toneOfVoice,
      fallbackMessage: dto.fallbackMessage ?? currentConfig.fallbackMessage,
      escalationMessage: dto.escalationMessage ?? currentConfig.escalationMessage,
      welcomeMessages: dto.welcomeMessages ?? currentConfig.welcomeMessages,
      suggestedQuestions: dto.suggestedQuestions ?? currentConfig.suggestedQuestions,
      tourSettings,
    };

    if (dto.apiKey && dto.apiKey.trim().length > 0 && !dto.apiKey.includes('••')) {
      dataToUpdate.encryptedApiKey = encryptSensitiveField(dto.apiKey.trim());
    }

    const updated = await this.prisma.aiConfig.update({
      where: { id: currentConfig.id },
      data: dataToUpdate,
    });

    return {
      ...updated,
      isInChatBookingEnabled: (updated.tourSettings as any)?.isInChatBookingEnabled !== false,
      encryptedApiKey: updated.encryptedApiKey ? '••••••••••••••••' : null,
    };
  }

  @Post('status')
  @ApiOperation({ summary: 'Update GuideR global operational status (ACTIVE / DISABLED / MAINTENANCE)' })
  async updateStatus(
    @Body() dto: UpdateGuiderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const adminUser = user?.email || user?.id || 'admin';
    return this.chatOrchestrator.updateGuiderStatus(dto, adminUser);
  }

  // --- Prompt Version Management ---

  @Get('prompts')
  @ApiOperation({ summary: 'Get all prompt versions (drafts, published, archived)' })
  async getPromptVersions() {
    return this.chatOrchestrator.getPromptVersions();
  }

  @Post('prompts/seed-defaults')
  @ApiOperation({ summary: 'Seed curated luxury prompt templates' })
  async seedDefaultPrompts() {
    await this.chatOrchestrator.seedDefaultPromptVersions();
    return this.chatOrchestrator.getPromptVersions();
  }

  @Post('prompts')
  @ApiOperation({ summary: 'Create a new draft prompt version' })
  async createPromptDraft(
    @Body() body: { name: string; systemPrompt: string; changeNote?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatOrchestrator.createPromptVersionDraft({
      ...body,
      userId: user?.id,
    });
  }

  @Put('prompts/:id')
  @ApiOperation({ summary: 'Update an existing prompt version (name, content, notes, status)' })
  async updatePromptVersion(
    @Param('id') id: string,
    @Body() body: { name?: string; systemPrompt?: string; changeNote?: string; status?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatOrchestrator.updatePromptVersion(id, body, user?.id);
  }

  @Delete('prompts/:id')
  @ApiOperation({ summary: 'Delete a prompt version' })
  async deletePromptVersion(@Param('id') id: string) {
    return this.chatOrchestrator.deletePromptVersion(id);
  }

  @Post('prompts/:id/archive')
  @ApiOperation({ summary: 'Archive a prompt version so it is disabled/inactive' })
  async archivePromptVersion(@Param('id') id: string) {
    return this.chatOrchestrator.archivePromptVersion(id);
  }

  @Post('prompts/:id/publish')
  @ApiOperation({ summary: 'Publish prompt version, making it the active production system prompt' })
  async publishPromptVersion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.chatOrchestrator.publishPromptVersion(id, user?.id);
  }

  @Post('prompts/:id/rollback')
  @ApiOperation({ summary: 'Rollback to a previous prompt version' })
  async rollbackPromptVersion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.chatOrchestrator.rollbackPromptVersion(id);
  }

  // --- Message Feedback ---

  @Get('feedback')
  @ApiOperation({ summary: 'Get traveler message ratings, satisfaction trends, and feedback' })
  async getFeedback(@Query('page') page = '1', @Query('limit') limit = '20') {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    return this.chatOrchestrator.getFeedbackList(pageNum, limitNum);
  }

  // --- Provider Registry Endpoints (NEW) ---

  @Get('providers')
  @ApiOperation({ summary: 'Get the official provider registry with setup instructions and API key links' })
  async getProviderRegistry() {
    return {
      providers: this.modelRegistry.getAvailableProviders(),
      routingTable: this.modelRouting.getRoutingTable(),
    };
  }

  @Get('providers/:id/models')
  @ApiOperation({ summary: 'Get models available for a specific provider' })
  async getProviderModels(@Param('id') id: string) {
    const provider = this.modelRegistry.getProvider(id);
    if (!provider) {
      throw new BadRequestException(`Unknown provider '${id}'.`);
    }
    return {
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        officialBaseUrl: provider.officialBaseUrl,
        apiKeyUrl: provider.apiKeyUrl,
        setupInstructions: provider.setupInstructions,
        allowCustomBaseUrl: provider.allowCustomBaseUrl,
      },
      models: this.modelRegistry.getPrimaryModelsForProvider(id),
    };
  }

  @Post('providers/:providerId/models/refresh')
  @ApiOperation({ summary: 'Discover and refresh live models available to a specific provider API key' })
  async refreshProviderModels(
    @Param('providerId') providerId: string,
    @Body() dto: RefreshProviderModelsDto,
  ) {
    return this.modelRegistry.discoverLiveModels(providerId, dto);
  }

  @Get('routing')
  @ApiOperation({ summary: 'Get the current GuideR model routing policy (Economy/Normal/Complex/Fallback)' })
  async getRoutingPolicy() {
    return {
      table: this.modelRouting.getRoutingTable(),
      agentPolicies: this.modelRouting.getAgentPolicies(),
    };
  }

  // --- API Key Pool Management Endpoints ---

  @Get('keys')
  @ApiOperation({ summary: 'Get all configured provider credentials (keys masked)' })
  async getKeyPool() {
    return this.keyPoolService.getKeyPool();
  }

  @Post('keys')
  @ApiOperation({ summary: 'Add a new provider credential. Provider/model pair is validated server-side.' })
  async addKeyToPool(@Body() body: AddProviderCredentialDto) {
    return this.keyPoolService.addKey(body);
  }

  @Put('keys/reorder')
  @ApiOperation({ summary: 'Reorder credential priority sequentially' })
  async reorderKeysInPool(@Body() body: { orderedIds: string[] }) {
    return this.keyPoolService.reorderKeys(body.orderedIds || []);
  }

  @Put('keys/:id')
  @ApiOperation({ summary: 'Update a credential. Leave apiKey blank to keep existing key.' })
  async updateKeyInPool(@Param('id') id: string, @Body() body: UpdateProviderCredentialDto) {
    return this.keyPoolService.updateKey(id, body);
  }

  @Delete('keys/:id')
  @ApiOperation({ summary: 'Remove a provider credential' })
  async deleteKeyFromPool(@Param('id') id: string) {
    return this.keyPoolService.deleteKey(id);
  }

  @Post('keys/:id/test')
  @ApiOperation({ summary: 'Test a credential — returns structured error code, not just success/failed' })
  async testSpecificKey(@Param('id') id: string) {
    return this.keyPoolService.testKey(id);
  }

  @Post('models/activate')
  @ApiOperation({ summary: 'Transactionally activate GuideR model and provider with optional connectivity verification' })
  async activateModel(
    @Body()
    body: {
      provider: string;
      model: string;
      credentialId?: string;
      testBeforeActivate?: boolean;
    },
  ) {
    if (!body.provider || !body.model) {
      throw new BadRequestException('Provider and model are required for activation.');
    }
    return this.keyPoolService.setActiveModel(body);
  }

  @Post('config/test')
  @ApiOperation({ summary: 'Test a provider connection with a specific key. Validates provider/model pair first.' })
  async testConnection(@Body() dto: TestProviderConnectionDto) {
    const currentConfig = await this.chatOrchestrator.getOrCreateConfig();
    const providerName = (dto.provider || currentConfig.provider || 'google').toLowerCase();
    const defaultModelForProvider =
      providerName === 'google'
        ? 'gemini-3.6-flash'
        : providerName === 'openai'
        ? 'gpt-4o-mini'
        : providerName === 'xai'
        ? 'grok-2-1212'
        : 'deepseek-chat';
    const model = (dto.model && dto.model.trim()) ? dto.model.trim() : defaultModelForProvider;

    // Validate provider/model pair BEFORE calling the provider
    if (model) {
      const validation = this.modelRegistry.validateProviderModelPair(providerName, model);
      if (!validation.valid) {
        return {
          success: false,
          code: 'INVALID_CONFIGURATION',
          provider: providerName,
          model,
          error: validation.reason,
          diagnosis: `Provider/model mismatch detected before making any API call. ${validation.reason}`,
        };
      }
    }

    const key =
      dto.apiKey && !dto.apiKey.includes('••')
        ? dto.apiKey
        : decryptSensitiveField(currentConfig.encryptedApiKey) || undefined;

    if (!key) {
      return {
        success: false,
        code: 'INVALID_KEY',
        provider: providerName,
        model,
        error: `No API key provided for provider '${providerName}'.`,
        diagnosis: 'Provide an API key or save a credential for this provider first.',
      };
    }

    try {
      const res = await this.universalProvider.generateCompletion(
        'Say "Connection verified" in exactly 2 words.',
        { provider: providerName, model, maxTokens: 30, timeoutMs: 12_000 },
        key,
      );
      return {
        success: true,
        code: 'SUCCESS',
        provider: providerName,
        model,
        latencyMs: res.latencyMs,
        message: res.text,
      };
    } catch (err: any) {
      const code = err instanceof ProviderError ? err.code : 'UNKNOWN_ERROR';
      return {
        success: false,
        code,
        provider: providerName,
        model,
        error: err.message,
        diagnosis: err instanceof ProviderError
          ? `[${code}] ${err.message}`
          : 'Unexpected error during connection test.',
      };
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get paginated list of chat conversations' })
  async getConversations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('leadStatus') leadStatus?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (leadStatus) whereClause.leadStatus = leadStatus;
    if (search) {
      whereClause.OR = [
        { visitorName: { contains: search, mode: 'insensitive' } },
        { visitorEmail: { contains: search, mode: 'insensitive' } },
        { visitorPhone: { contains: search, mode: 'insensitive' } },
        { publicSessionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.chatConversation.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get detailed conversation transcript & visitor details' })
  async getConversationDetail(@Param('id') id: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation;
  }

  @Post('conversations/:id/takeover')
  @ApiOperation({ summary: 'Staff takes over conversation (pauses autonomous AI)' })
  async takeoverConversation(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.chatOrchestrator.takeoverConversation(id, user?.id || 'admin');
  }

  @Post('conversations/:id/reply')
  @ApiOperation({ summary: 'Send direct staff message to visitor' })
  async staffReply(
    @Param('id') id: string,
    @Body() body: { text: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatOrchestrator.staffReplyToConversation(id, body.text, { id: user?.id, name: user?.email });
  }

  @Post('conversations/:id/return-to-ai')
  @ApiOperation({ summary: 'Return conversation to autonomous AI management' })
  async returnToAi(@Param('id') id: string) {
    return this.chatOrchestrator.returnToAi(id);
  }

  @Post('conversations/:id/resolve')
  @ApiOperation({ summary: 'Resolve and close conversation' })
  async resolveConversation(@Param('id') id: string) {
    return this.chatOrchestrator.resolveConversation(id);
  }

  @Get('safety-events')
  @ApiOperation({ summary: 'Get security and safety audit events (blocked attacks, errors)' })
  async getSafetyEvents(@Query('page') page = '1', @Query('limit') limit = '20') {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    return this.chatOrchestrator.getSafetyEvents(pageNum, limitNum);
  }

  @Post('simulator')
  @ApiOperation({ summary: 'Run live test message through the AI orchestrator' })
  async runSimulator(@Body() dto: SendChatMessageDto) {
    return this.chatOrchestrator.processVisitorMessage(dto);
  }

  // --- AI Agent Registry Management ---

  @Get('agents')
  @ApiOperation({ summary: 'Get all AI Agents in registry' })
  async getAgents(@Query('locale') locale = 'en') {
    return this.agentRegistry.getAllAgents(locale);
  }

  @Get('agents/:slug')
  @ApiOperation({ summary: 'Get AI Agent detail by slug' })
  async getAgentBySlug(@Param('slug') slug: string, @Query('locale') locale = 'en') {
    return this.agentRegistry.getAgentBySlug(slug, locale);
  }

  @Post('agents')
  @ApiOperation({ summary: 'Create new AI Agent in registry' })
  async createAgent(@Body() dto: CreateAgentDto) {
    return this.agentRegistry.createAgent(dto);
  }

  @Put('agents/:id')
  @ApiOperation({ summary: 'Update AI Agent configuration' })
  async updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentRegistry.updateAgent(id, dto);
  }

  @Post('agents/:id/activate')
  @ApiOperation({ summary: 'Set this agent persona as the single active AI assistant on the live website' })
  async activateAgent(@Param('id') id: string) {
    const activated = await this.agentRegistry.activateSingleAgent(id);
    return { success: true, agent: activated };
  }

  @Delete('agents/:id')
  @ApiOperation({ summary: 'Delete AI Agent from registry' })
  async deleteAgent(@Param('id') id: string) {
    return this.agentRegistry.deleteAgent(id);
  }

  // --- Model Registry ---

  @Get('models')
  @ApiOperation({ summary: 'Get full model registry with capabilities, pricing, and provider info' })
  async getAllModels() {
    const rawModels = this.modelRegistry.getAllModels();
    const models = rawModels.map((m) => ({
      ...m,
      provider: m.providerId,
      name: m.displayName,
      nameAr: m.displayNameAr,
      inputCostPer1M: m.inputPricePerMillion,
      outputCostPer1M: m.outputPricePerMillion,
    }));
    return {
      models,
      providers: this.modelRegistry.getAvailableProviders(),
      routingTable: this.modelRouting.getRoutingTable(),
    };
  }

  // --- Testing Lab Diagnostics Trace ---

  @Post('simulator/trace')
  @ApiOperation({ summary: 'Run diagnostic test query returning full inspection trace (intent, agent, model, RAG chunks, live DB calls, cost)' })
  async runSimulatorTrace(
    @Body()
    body: {
      message: string;
      agentSlug?: string;
      model?: string;
      provider?: string;
      locale?: string;
      promptVersionId?: string;
      enableRag?: boolean;
      enableLiveDb?: boolean;
    },
  ) {
    const startTime = Date.now();
    const locale = body.locale || 'en';
    const agentSlug = body.agentSlug || 'guider';
    const agent = await this.agentRegistry.getAgentBySlug(agentSlug, locale);

    const modelId = body.model || agent.primaryModel || 'gemini-3.5-flash';
    const providerName = body.provider || agent.provider || 'google';

    // 1. RAG & Live Structured Retrieval
    let retrievalContext = null;
    let retrievalLatency = 0;
    if (body.enableRag !== false) {
      const ragStart = Date.now();
      retrievalContext = await this.hybridRagEngine.retrieveGroundedKnowledge(
        body.message,
        locale,
        agent.allowedSources || ['tours', 'destinations', 'policies', 'hotels', 'transportation'],
        4,
      );
      retrievalLatency = Date.now() - ragStart;
    }

    // 2. Prompt Compilation
    const systemPromptBase = agent.systemPrompt || 'You are GuideR, luxury AI concierge for Dunas Travel.';
    const compiledSystemPrompt = this.promptEngine.renderTemplate(systemPromptBase, {
      agentName: agent.displayName || agent.slug,
      visitorLanguage: locale,
      businessName: 'Dunas Travel',
      groundedKnowledge: retrievalContext?.groundedSummaryText || 'No extra catalog items.',
    });

    // 3. Execution via Decrypted API Key & Universal Provider
    const credentialRow = await (this.prisma as any).aiProviderCredential.findFirst({
      where: {
        isActive: true,
        provider: providerName,
      },
      orderBy: { priority: 'asc' },
    });
    const decryptedKey = credentialRow ? decryptSensitiveField(credentialRow.encryptedApiKey) : undefined;

    let llmResponse = null;
    let providerError = null;
    try {
      if (!decryptedKey) {
        throw new Error(`No active API key found for provider '${providerName}'.`);
      }
      llmResponse = await this.universalProvider.generateCompletion(
        body.message,
        {
          provider: providerName,
          model: modelId,
          systemPrompt: compiledSystemPrompt,
          temperature: agent.temperature || 0.7,
          maxTokens: agent.maxTokens || 1024,
          timeoutMs: 15_000,
        },
        decryptedKey,
      );
    } catch (err: any) {
      providerError = err.message;
      const isArabic = locale.startsWith('ar');
      const topTour = retrievalContext?.groundedTours?.[0];
      let fallbackText = '';
      if (isArabic) {
        if (topTour) {
          const loc = [topTour.city, topTour.country].filter(Boolean).join('، ') || 'مصر';
          const price = topTour.basePriceUsd || 1200;
          fallbackText = `أهلاً بك في دوناس ترافيل! يسعدنا جداً تقديم أرقى البرامج السياحية لك. بناءً على استفسارك، نقترح عليك رحلة "${topTour.title}" في (${loc})، بسعر يبدأ من $${price} ${topTour.currency || 'USD'} وتتضمن إقامة فاخرة، وجولات سياحية خاصة مع مرشد خبير، وانتقالات VIP خاصة.\n\nهل ترغب في تفاصيل البرنامج اليومي أو تخصيص تواريخ رحلتك؟`;
        } else {
          fallbackText = `أهلاً بك في دوناس ترافيل! يسعدنا جداً مساعدتك في التخطيط لرحلتك الفاخرة القادمة. نقدم برامج سياحية متكاملة تشمل القاهرة والجيزة والإبحار بدهبيات خاصة أو كروزات 5 نجوم ديلوكس في النيل بين الأقصر وأسوان، بالإضافة إلى منتجعات البحر الأحمر.\n\nكيف تود أن نخصص برنامج رحلتك القادمة؟`;
        }
      } else {
        if (topTour) {
          const loc = [topTour.city, topTour.country].filter(Boolean).join(', ') || 'Egypt';
          const price = topTour.basePriceUsd || 1200;
          fallbackText = `Welcome to Dunas Travel! We are delighted to assist you with our signature luxury offerings. We recommend our "${topTour.title}" in ${loc}, starting from $${price} ${topTour.currency || 'USD'}, featuring 5-star deluxe accommodation, private transfers, and VIP guided heritage excursions.\n\nWould you like us to customize the itinerary dates for you?`;
        } else {
          fallbackText = `Welcome to Dunas Travel! We specialize in bespoke high-end journeys across Cairo, private Nile Dahabiyas, and luxury Red Sea resorts. How may I assist you with your travel plans today?`;
        }
      }

      llmResponse = {
        text: fallbackText,
        inputTokens: Math.ceil(compiledSystemPrompt.length / 4) + Math.ceil(body.message.length / 4),
        outputTokens: Math.ceil(fallbackText.length / 4),
        latencyMs: Date.now() - startTime - retrievalLatency,
        provider: providerName,
        model: modelId,
      };
    }

    const totalLatency = Date.now() - startTime;
    const estimatedCostUsd = this.modelRegistry.calculateCostUsd(
      modelId,
      llmResponse.inputTokens,
      llmResponse.outputTokens,
    );

    return {
      traceId: `trace-${Date.now()}`,
      answer: llmResponse.text,
      agent: {
        id: agent.id,
        slug: agent.slug,
        name: agent.displayName,
        role: agent.role,
        avatar: agent.avatar,
      },
      model: {
        id: modelId,
        provider: providerName,
        info: this.modelRegistry.getModelInfo(modelId),
      },
      retrieval: {
        enabled: body.enableRag !== false,
        latencyMs: retrievalLatency,
        matchedChunks: retrievalContext?.matchedChunks || [],
        groundedTours: retrievalContext?.groundedTours || [],
        groundedHotels: retrievalContext?.groundedHotels || [],
        groundedTransportation: retrievalContext?.groundedTransportation || [],
      },
      prompt: {
        compiledSystemPrompt,
        versionId: body.promptVersionId || agent.activePromptVersionId || 'active-v1',
      },
      telemetry: {
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
        totalTokens: llmResponse.inputTokens + llmResponse.outputTokens,
        estimatedCostUsd,
        totalLatencyMs: totalLatency,
        providerLatencyMs: llmResponse.latencyMs,
        providerError,
      },
    };
  }
}
