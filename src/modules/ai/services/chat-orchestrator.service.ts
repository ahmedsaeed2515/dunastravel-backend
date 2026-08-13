import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { RagRetrievalService, GroundingSource } from './rag-retrieval.service';
import { TourCatalogToolService, GroundedTourRecommendation, GroundedDestinationRecommendation } from './tour-catalog-tool.service';
import { sanitizePlainText } from '../../../common/utils/content-sanitizer.util';

export interface ProcessChatMessageDto {
  message: string;
  sessionId: string;
  locale?: string;
  pageContext?: {
    tourSlug?: string;
    destinationSlug?: string;
    pathname?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
  };
  visitorInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  };
}

const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /override\s+rules/i,
  /forget\s+all\s+rules/i,
  /<script>/i,
];

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly ragRetrieval: RagRetrievalService,
    private readonly tourCatalogTool: TourCatalogToolService,
  ) {}

  private validateInput(text: string) {
    if (!text || !text.trim()) {
      throw new BadRequestException('Message content cannot be empty');
    }
    if (text.length > 2000) {
      throw new BadRequestException('Message content exceeds maximum length of 2000 characters');
    }
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        throw new BadRequestException('Security violation: malicious input pattern detected');
      }
    }
  }

  async getOrCreateConfig() {
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
          systemInstructions: `You are Jaider, a world-class luxury travel sales consultant for Dunas Travel (DUNAS Travel).
Your role is to assist visitors in discovering Egypt, Turkey, Jordan, Dubai, Morocco, and Greece travel experiences.
Always be polite, warm, executive, professional, and knowledgeable.
NEVER invent tours, prices, or policies. Only use the provided grounded catalog tours and knowledge documents.
If information is not available, offer to connect the visitor with a senior human consultant.`,
          salesPersonality: 'Luxury Concierge',
          toneOfVoice: 'Warm, Executive, Helpful',
          fallbackMessage: `I'm sorry, I couldn't find exact details for your request right now. Would you like me to connect you with one of our travel specialists?`,
          escalationMessage: `I have notified our senior travel team. A travel specialist will contact you shortly!`,
          welcomeMessages: {
            en: "Hi there! 👋 I'm Jaider, your luxury travel assistant for Dunas Travel. How can I help plan your dream trip today?",
            ar: "مرحباً! 👋 أنا جايدر، مساعدك السياحي في دوناس ترافيل. كيف يمكنني مساعدتك في التخطيط لرحلتك المثالية اليوم؟",
            es: "¡Hola! 👋 Soy Jaider, tu asistente de viajes de lujo para Dunas Travel. ¿Cómo puedo ayudarte a planificar tu viaje ideal hoy?",
            pt: "Olá! 👋 Eu sou o Jaider, seu assistente de viagens de luxo para a Dunas Travel. Como posso ajudar a planejar sua viagem dos sonhos hoje?",
            it: "Ciao! 👋 Sono Jaider, il tuo assistente di viaggio di lusso per Dunas Travel. Come posso aiutarti a pianificare il tuo viaggio ideale oggi?",
          },
          suggestedQuestions: {
            en: [
              "Recommend top Nile Cruise packages",
              "What payment methods do you accept?",
              "Can you customize a tour for my family?",
              "What is your cancellation policy?"
            ],
            ar: [
              "اقترح علي أفضل رحلات النيل البحرية",
              "ما هي طرق الدفع المتاحة؟",
              "هل يمكن تخصيص رحلة لعائلتي؟",
              "ما هي سياسة الإلغاء لديكم؟"
            ],
            es: [
              "Recomienda paquetes de Crucero por el Nilo",
              "¿Qué métodos de pago aceptan?",
              "¿Pueden personalizar un tour para mi familia?",
              "¿Cuál es su política de cancelación?"
            ]
          }
        },
      });
    }

    return config;
  }

  async getConversationHistory(sessionId: string) {
    if (!sessionId) return { messages: [] };

    const conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { publicSessionId: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) return { messages: [] };

    return {
      conversationId: conversation.id,
      status: conversation.status,
      leadStatus: conversation.leadStatus,
      messages: conversation.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.textContent,
        createdAt: m.createdAt,
        tours: m.recommendedTourIds,
        sources: m.knowledgeSources,
      })),
    };
  }

  async processVisitorMessage(dto: ProcessChatMessageDto) {
    this.validateInput(dto.message);
    const sanitizedMsg = sanitizePlainText(dto.message);
    const locale = (dto.locale || 'en').toLowerCase();

    const config = await this.getOrCreateConfig();

    if (!config.isEnabled || !config.isPublicEnabled) {
      throw new ServiceUnavailableException('The AI Chatbot service is currently disabled.');
    }

    // 1. Get or create conversation session
    let conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { publicSessionId: dto.sessionId },
      include: {
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!conversation) {
      conversation = await (this.prisma as any).chatConversation.create({
        data: {
          publicSessionId: dto.sessionId,
          locale,
          status: 'ACTIVE',
          visitorName: dto.visitorInfo?.name,
          visitorEmail: dto.visitorInfo?.email,
          visitorPhone: dto.visitorInfo?.phone,
          visitorNationality: dto.visitorInfo?.nationality,
          currentPage: dto.pageContext?.pathname,
          utmSource: dto.pageContext?.utmSource,
          utmMedium: dto.pageContext?.utmMedium,
          utmCampaign: dto.pageContext?.utmCampaign,
          referrer: dto.pageContext?.referrer,
        },
        include: {
          messages: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } else if (dto.visitorInfo) {
      conversation = await (this.prisma as any).chatConversation.update({
        where: { id: conversation.id },
        data: {
          visitorName: dto.visitorInfo.name || conversation.visitorName,
          visitorEmail: dto.visitorInfo.email || conversation.visitorEmail,
          visitorPhone: dto.visitorInfo.phone || conversation.visitorPhone,
          visitorNationality: dto.visitorInfo.nationality || conversation.visitorNationality,
        },
        include: {
          messages: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    // 2. Save user message
    await (this.prisma as any).chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        textContent: sanitizedMsg,
        locale,
      },
    });

    // 3. Extract keywords & retrieve RAG knowledge and grounded tour catalog
    const keywords = sanitizedMsg
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const [sources, recommendedTours, recommendedDestinations] = await Promise.all([
      this.ragRetrieval.retrieveRelevantKnowledge(sanitizedMsg, locale, 4),
      this.tourCatalogTool.searchGroundedTours(keywords, 3),
      this.tourCatalogTool.searchGroundedDestinations(keywords, 2),
    ]);

    // 4. Assemble system prompt stack
    const ragContext = sources.length > 0
      ? `GROUNDED KNOWLEDGE BASE:\n${sources.map((s) => `[${s.title}]: ${s.content}`).join('\n')}`
      : 'No specific knowledge base articles found.';

    const tourContext = recommendedTours.length > 0
      ? `REAL GROUNDED CATALOG TOURS:\n${recommendedTours.map((t) => `- ${t.title} (${t.destination}) - Price: $${t.price} ${t.currency} - URL: ${t.publicUrl}`).join('\n')}`
      : 'No specific catalog tour matches found.';

    const historyContext = conversation.messages
      .slice()
      .reverse()
      .map((m: any) => `${m.role.toUpperCase()}: ${m.textContent}`)
      .join('\n');

    const fullSystemPrompt = `${config.systemInstructions}

PERSONALITY: ${config.salesPersonality || 'Executive Concierge'}
TONE: ${config.toneOfVoice || 'Warm, Professional'}

${ragContext}

${tourContext}

CRITICAL RULES:
- Never fabricate tours, prices, or policies that are not present above.
- Respond in the language of the user message (Locale detected: ${locale}).
- Be concise, helpful, and encourage booking inquiry or custom trip tailoring.`;

    const userPrompt = historyContext
      ? `CONVERSATION HISTORY:\n${historyContext}\n\nUSER MESSAGE:\n${sanitizedMsg}`
      : sanitizedMsg;

    // 5. Invoke Provider
    let assistantReply = config.fallbackMessage;
    let inputTokens = 0;
    let outputTokens = 0;
    let latencyMs = 0;
    let isError = false;

    try {
      const response = await this.anthropicProvider.generateCompletion(
        userPrompt,
        {
          systemPrompt: fullSystemPrompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          timeoutMs: config.requestTimeoutMs,
          model: config.model,
        },
        config.encryptedApiKey || undefined,
      );

      assistantReply = response.text || config.fallbackMessage;
      inputTokens = response.inputTokens;
      outputTokens = response.outputTokens;
      latencyMs = response.latencyMs;
    } catch (err: any) {
      this.logger.error(`AI provider call failed: ${err.message}`);
      isError = true;
      if (recommendedTours.length > 0) {
        const topTour = recommendedTours[0];
        assistantReply = locale.startsWith('ar')
          ? `أهلاً بك! يسعدني إجابة سؤالك وتوصيتك برحلة "${topTour.title}" المميزة والتي تقع في ${topTour.destination} بسعر يبدأ من $${topTour.price} ${topTour.currency}. يسعدنا مساعدتك في حجزها الآن!`
          : `Hello! I'd be happy to recommend our top tour "${topTour.title}" located in ${topTour.destination} starting from $${topTour.price} ${topTour.currency}. Click below to explore full details!`;
      } else if (sources.length > 0) {
        assistantReply = sources[0].content;
      } else {
        assistantReply = config.fallbackMessage;
      }
    }

    // 6. Save assistant response to DB
    const assistantMsg = await (this.prisma as any).chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        textContent: assistantReply,
        locale,
        provider: config.provider,
        model: config.model,
        inputTokens,
        outputTokens,
        latencyMs,
        isError,
        knowledgeSources: sources as any,
        recommendedTourIds: recommendedTours.map((t) => t.id),
        recommendedDestinations: recommendedDestinations.map((d) => d.id),
      },
    });

    // 7. Log telemetry
    await (this.prisma as any).aiUsageLog.create({
      data: {
        provider: config.provider,
        model: config.model,
        inputTokens,
        outputTokens,
        latencyMs,
        isSuccess: !isError,
        conversationId: conversation.id,
        sessionId: dto.sessionId,
        endpoint: '/api/ai/chat/message',
      },
    });

    // 8. Lead capture heuristic check
    const hasContactDetails = Boolean(conversation.visitorEmail || conversation.visitorPhone);
    const requiresLeadForm = !hasContactDetails && (
      keywords.some((k) => ['book', 'price', 'reserve', 'inquire', 'quote', 'حجز', 'سعر', 'تواصل', 'اميل'].includes(k))
    );

    const suggestedReplies = locale.startsWith('ar')
      ? ["احجز رحلة الآن", "اريد تخصيص رحلة", "تحدث مع ممثل مبيعات"]
      : ["Book a tour now", "Customize a trip", "Speak with sales representative"];

    return {
      conversationId: conversation.id,
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: assistantReply,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
      recommendations: {
        tours: recommendedTours,
        destinations: recommendedDestinations,
      },
      suggestedReplies,
      actions: [],
      handoff: {
        available: true,
        requested: conversation.status === 'HANDED_OFF',
        status: conversation.status,
      },
      leadCapture: {
        required: requiresLeadForm,
        fields: ['name', 'email', 'phone'],
      },
      sources,
    };
  }

  async submitLead(sessionId: string, visitorInfo: { name: string; email: string; phone?: string; nationality?: string }) {
    const conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { publicSessionId: sessionId },
    });

    if (!conversation) {
      throw new BadRequestException('Invalid chat session token');
    }

    let customerId: string | undefined = undefined;

    // Create or find CRM User
    if (visitorInfo.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: visitorInfo.email, deletedAt: null },
      });

      if (existingUser) {
        customerId = existingUser.id;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            name: visitorInfo.name,
            email: visitorInfo.email,
            phone: visitorInfo.phone,
            nationality: visitorInfo.nationality,
            role: 'USER',
            passwordHash: 'CHATBOT_QUALIFIED_LEAD',
            customerSource: 'AI_CHATBOT',
            tags: ['AI_LEAD', 'QUALIFIED'],
          },
        }).catch((e) => {
          this.logger.warn(`Could not create CRM user for lead: ${e.message}`);
          return null;
        });

        if (newUser) customerId = newUser.id;
      }
    }

    const updated = await (this.prisma as any).chatConversation.update({
      where: { id: conversation.id },
      data: {
        visitorName: visitorInfo.name,
        visitorEmail: visitorInfo.email,
        visitorPhone: visitorInfo.phone || conversation.visitorPhone,
        visitorNationality: visitorInfo.nationality || conversation.visitorNationality,
        customerId: customerId || conversation.customerId,
        leadStatus: 'QUALIFIED',
        leadScore: 85,
      },
    });

    return { success: true, leadId: customerId || updated.id, leadStatus: updated.leadStatus };
  }

  async requestHumanHandoff(sessionId: string) {
    const conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { publicSessionId: sessionId },
    });

    if (!conversation) {
      throw new BadRequestException('Invalid chat session token');
    }

    const updated = await (this.prisma as any).chatConversation.update({
      where: { id: conversation.id },
      data: {
        status: 'HANDED_OFF',
        handedOffAt: new Date(),
      },
    });

    // Create internal notification delivery log for sales alert
    await this.prisma.notificationDeliveryLog.create({
      data: {
        notificationType: 'INTERNAL_SALES_ALERT',
        originReferenceCode: conversation.publicSessionId.slice(0, 50),
        originEntityType: 'CHAT_HANDOFF',
        recipientEmail: 'sales@dunas-travel.com',
        status: 'PENDING',
      },
    }).catch((e) => this.logger.warn(`Could not create notification log for handoff: ${e.message}`));

    return {
      success: true,
      status: updated.status,
      message: 'Human sales consultant requested. A travel specialist will be with you shortly.',
    };
  }
}
