import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { UpdateAiConfigDto, TestProviderConnectionDto } from './dto/admin-ai.dto';
import { SendChatMessageDto } from './dto/public-chat.dto';

@ApiTags('Admin - AI Command Center')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminAiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatOrchestrator: ChatOrchestratorService,
    private readonly anthropicProvider: AnthropicProvider,
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
    ] = await Promise.all([
      this.prisma.chatConversation.count(),
      this.prisma.chatConversation.count({ where: { status: 'ACTIVE' } }),
      this.prisma.chatConversation.count({ where: { status: 'HANDED_OFF' } }),
      this.prisma.chatConversation.count({ where: { leadStatus: 'QUALIFIED' } }),
      this.prisma.aiUsageLog.aggregate({
        _sum: { inputTokens: true, outputTokens: true, latencyMs: true },
        _count: { id: true },
      }),
      this.prisma.knowledgeBaseItem.count({ where: { status: 'PUBLISHED' } }),
    ]);

    const totalLogs = totalUsageLogs._count.id || 1;
    const avgLatencyMs = Math.round((totalUsageLogs._sum.latencyMs || 0) / totalLogs);
    const totalInputTokens = totalUsageLogs._sum.inputTokens || 0;
    const totalOutputTokens = totalUsageLogs._sum.outputTokens || 0;
    const estimatedCostUsd = ((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000).toFixed(4);

    return {
      metrics: {
        totalConversations,
        activeConversations,
        handedOffConversations,
        qualifiedLeads,
        publishedKnowledgeArticles: knowledgeCount,
        avgLatencyMs,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCostUsd: Number(estimatedCostUsd),
      },
    };
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
      dataToUpdate.encryptedApiKey = dto.apiKey.trim();
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

  @Post('config/test')
  @ApiOperation({ summary: 'Safely test connection to configured AI provider' })
  async testConnection(@Body() dto: TestProviderConnectionDto) {
    const currentConfig = await this.chatOrchestrator.getOrCreateConfig();
    const providerName = dto.provider || currentConfig.provider;
    const model = dto.model || currentConfig.model;
    const key = (dto.apiKey && !dto.apiKey.includes('••')) ? dto.apiKey : currentConfig.encryptedApiKey || undefined;

    if (providerName === 'anthropic') {
      const isConfigured = this.anthropicProvider.isConfigured(key);
      if (!isConfigured) {
        return { success: false, message: 'Anthropic API key is missing or unconfigured.' };
      }

      try {
        const res = await this.anthropicProvider.generateCompletion(
          'Say "Connection verified successfully!" in 5 words.',
          { maxTokens: 30, model },
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

    return { success: false, message: `Provider '${providerName}' is not currently supported.` };
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

  @Post('simulator')
  @ApiOperation({ summary: 'Run live test message through the AI orchestrator' })
  async runSimulator(@Body() dto: SendChatMessageDto) {
    return this.chatOrchestrator.processVisitorMessage(dto);
  }
}
