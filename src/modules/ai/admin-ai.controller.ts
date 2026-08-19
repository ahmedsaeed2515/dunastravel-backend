import { Controller, Get, Put, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { UniversalAiProvider } from './providers/universal-ai.provider';
import { AiKeyPoolService } from './services/ai-key-pool.service';
import { UpdateAiConfigDto, TestProviderConnectionDto } from './dto/admin-ai.dto';
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
      keyPool,
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
      this.keyPoolService.getKeyPool(),
    ]);

    const totalLogs = totalUsageLogs._count.id || 1;
    const avgLatencyMs = Math.round((totalUsageLogs._sum.latencyMs || 0) / totalLogs);
    const totalInputTokens = totalUsageLogs._sum.inputTokens || 0;
    const totalOutputTokens = totalUsageLogs._sum.outputTokens || 0;
    const estimatedCostUsd = Number(totalUsageLogs._sum.estimatedCostUsd || ((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000).toFixed(4));

    return {
      metrics: {
        totalConversations,
        activeConversations,
        handedOffConversations,
        qualifiedLeads,
        publishedKnowledgeArticles: knowledgeCount,
        configuredApiKeysCount: keyPool.length,
        healthyApiKeysCount: keyPool.filter((k) => k.lastStatus === 'HEALTHY' || k.lastStatus === 'UNTESTED').length,
        avgLatencyMs,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCostUsd,
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
    return {
      ...config,
      encryptedApiKey: config.encryptedApiKey ? '••••••••••••••••' : null,
    };
  }

  @Put('config')
  @ApiOperation({ summary: 'Update AI chatbot configuration' })
  async updateConfig(@Body() dto: UpdateAiConfigDto) {
    const currentConfig = await this.chatOrchestrator.getOrCreateConfig();

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
      encryptedApiKey: updated.encryptedApiKey ? '••••••••••••••••' : null,
    };
  }

  // --- Prompt Version Management ---

  @Get('prompts')
  @ApiOperation({ summary: 'Get all prompt versions (drafts, published, archived)' })
  async getPromptVersions() {
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

  // --- API Key Pool Management Endpoints ---

  @Get('keys')
  @ApiOperation({ summary: 'Get all configured API keys in the multi-provider pool (masked)' })
  async getKeyPool() {
    return this.keyPoolService.getKeyPool();
  }

  @Post('keys')
  @ApiOperation({ summary: 'Add a new API key to the failover pool' })
  async addKeyToPool(
    @Body()
    body: {
      provider: string;
      model: string;
      apiKey: string;
      baseUrl?: string;
      label?: string;
      priority?: number;
      isActive?: boolean;
    },
  ) {
    return this.keyPoolService.addKey(body);
  }

  @Put('keys/:id')
  @ApiOperation({ summary: 'Update an existing API key entry or toggle status' })
  async updateKeyInPool(
    @Param('id') id: string,
    @Body()
    body: {
      provider?: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
      label?: string;
      priority?: number;
      isActive?: boolean;
    },
  ) {
    return this.keyPoolService.updateKey(id, body);
  }

  @Delete('keys/:id')
  @ApiOperation({ summary: 'Delete an API key from the pool' })
  async deleteKeyFromPool(@Param('id') id: string) {
    return this.keyPoolService.deleteKey(id);
  }

  @Post('keys/:id/test')
  @ApiOperation({ summary: 'Test health, connectivity, and latency of a specific API key in the pool' })
  async testSpecificKey(@Param('id') id: string) {
    return this.keyPoolService.testKey(id);
  }

  @Post('config/test')
  @ApiOperation({ summary: 'Safely test connection to configured AI provider or custom key' })
  async testConnection(@Body() dto: TestProviderConnectionDto) {
    const currentConfig = await this.chatOrchestrator.getOrCreateConfig();
    const providerName = dto.provider || currentConfig.provider || 'anthropic';
    const model = dto.model || currentConfig.model;
    const key =
      dto.apiKey && !dto.apiKey.includes('••')
        ? dto.apiKey
        : decryptSensitiveField(currentConfig.encryptedApiKey) || undefined;

    if (!key) {
      return { success: false, message: `No API key provided or configured for provider '${providerName}'.` };
    }

    try {
      const res = await this.universalProvider.generateCompletion(
        'Say "Connection verified successfully!" in 4 words.',
        {
          provider: providerName,
          model,
          maxTokens: 30,
          timeoutMs: 12_000,
        },
        key,
      );
      return {
        success: true,
        provider: providerName,
        model,
        latencyMs: res.latencyMs,
        message: res.text,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
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
}
