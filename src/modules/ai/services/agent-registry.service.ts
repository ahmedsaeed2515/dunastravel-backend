import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateAgentDto {
  slug: string;
  nameJsonb: Record<string, string>;
  descriptionJsonb?: Record<string, string>;
  role: string;
  avatar?: string;
  systemPrompt?: string;
  personalityGuidelines?: string;
  tone?: string;
  primaryModel?: string;
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
  allowedSources?: string[];
  allowedTools?: string[];
  supportedLanguages?: string[];
  defaultLanguage?: string;
  isActive?: boolean;
  isPublic?: boolean;
}

export interface UpdateAgentDto extends Partial<CreateAgentDto> {
  activePromptVersionId?: string;
}

export const DEFAULT_PRESET_AGENTS: CreateAgentDto[] = [
  {
    slug: 'guider',
    nameJsonb: {
      en: 'GuideR — Royal Luxury Concierge',
      ar: 'جايدر — الكونسيرج الملكي الفاخر',
      es: 'GuideR — Conserje Real de Lujo',
      pt: 'GuideR — Concierge Real de Luxo',
      it: 'GuideR — Concierge Reale di Lusso',
    },
    descriptionJsonb: {
      en: 'Executive white-glove travel designer for luxury Egyptian journeys, Nile cruises, and VIP hospitality.',
      ar: 'المستشار السياحي الحصري للرحلات الملكية الفاخرة، كروز النيل الخاص، والضيافة الاستثنائية.',
      es: 'Diseñador de viajes de guante blanco para itinerarios de lujo en Egipto y cruceros por el Nilo.',
      pt: 'Designer de viagens executivo para roteiros de luxo no Egito e cruzeiros no Nilo.',
      it: 'Travel designer esclusivo per itinerari di lusso in Egitto e crociere sul Nilo.',
    },
    role: 'Travel Concierge',
    avatar: '👑',
    tone: 'Sophisticated, Ultra-Polite, Executive & Refined',
    personalityGuidelines: 'Speak with effortless elegance, like a chief concierge at Four Seasons or St. Regis. Highlight private Dahabiyas, presidential suites, private jets, and VIP fast-track transfers.',
    systemPrompt: `You are GuideR, the premier luxury AI Travel Concierge for Dunas Travel.
You represent the pinnacle of bespoke Egyptian hospitality.
Adhere strictly to these principles:
1. ONLY recommend real tours, hotels, and services available in Dunas Travel's grounded catalog.
2. Ground all dynamic facts (prices, dates, availability) in live structured data.
3. Respond in the exact language the traveler used (Arabic, English, Spanish, Portuguese, Italian).
4. For custom multi-day plans, provide structured day-by-day itineraries with private transfers, 5-star accommodations, and private Egyptologist guides.
5. ZERO ARCHAIC HONORIFICS: Never use archaic formulas like "سيدي/سيدتي" or "يا فندم". Speak warmly, naturally, and authoritatively as an elite modern concierge.
6. ZERO CATALOG DUMPING: For general questions (weather, history, advice), answer directly without dumping tour listings unless requested.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.5-flash', 'gpt-4o-mini'],
    temperature: 0.7,
    maxTokens: 1200,
    allowedSources: ['tours', 'destinations', 'policies', 'hotels', 'transportation'],
    allowedTools: ['search_catalog', 'check_availability', 'tailor_itinerary', 'book_tour'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: true,
    isPublic: true,
  },
  {
    slug: 'booking_specialist',
    nameJsonb: {
      en: 'Booking & Reservations Specialist',
      ar: 'أخصائي الحجوزات وتأكيد المواعيد',
      es: 'Especialista en Reservas y Confirmación',
      pt: 'Especialista em Reservas e Confirmação',
      it: 'Specialista Prenotazioni e Conferme',
    },
    descriptionJsonb: {
      en: 'Handles direct tour reservations, arrival coordination, group billing, and invoice generation.',
      ar: 'مختص بتأكيد الحجوزات المباشرة، تنسيق مواعيد الوصول، وتفاصيل الفواتير والسداد.',
      es: 'Gestiona reservas directas, coordinación de llegadas y emisión de facturas.',
      pt: 'Gerencia reservas diretas, coordenação de chegada e faturas.',
      it: 'Gestisce prenotazioni dirette, arrivi e fatturazione.',
    },
    role: 'Booking Specialist',
    avatar: '📅',
    tone: 'Precise, Efficient, Reassuring & Transparent',
    personalityGuidelines: 'Guide travelers step-by-step through dates, traveler counts, invoice summaries, and secure payment steps.',
    systemPrompt: `You are the Booking & Reservations Specialist for Dunas Travel.
Your responsibility is validating traveler arrival dates, guest counts (adults, children), and creating verified booking reservations.
Never state a booking is completed unless backend invoice/booking reference has been issued.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.5-flash', 'gpt-4o-mini'],
    temperature: 0.3,
    maxTokens: 800,
    allowedSources: ['tours', 'policies', 'transportation'],
    allowedTools: ['check_availability', 'book_tour', 'calculate_pricing'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: false,
    isPublic: true,
  },
  {
    slug: 'sales_concierge',
    nameJsonb: {
      en: 'VIP & Tailor-Made Sales Consultant',
      ar: 'مستشار المبيعات وباقات كبار الشخصيات VIP',
      es: 'Consultor de Ventas VIP y Viajes a Medida',
      pt: 'Consultor de Vendas VIP e Roteiros Personalizados',
      it: 'Consulente Vendite VIP e Viaggi su Misura',
    },
    descriptionJsonb: {
      en: 'Specialized in high-value customized itineraries, luxury Nile Dahabiya charters, and presidential suites.',
      ar: 'متخصص في تخطيط البرامج المصممة خصيصاً، تأجير الدهبيات الخاصة، وأجنحة كبار الشخصيات.',
      es: 'Especializado en itinerarios personalizados de alto valor y Dahabiyas privadas.',
      pt: 'Especializado em roteiros sob medida de alto padrão e Dahabiyas exclusivas.',
      it: 'Specializzato in viaggi su misura di alto livello e Dahabiya private.',
    },
    role: 'Sales Consultant',
    avatar: '💎',
    tone: 'Consultative, Persuasive, Elegant & Value-Focused',
    personalityGuidelines: 'Uncover traveler passions, recommend private experiences, and construct custom luxury packages.',
    systemPrompt: `You are the VIP Sales Consultant for Dunas Travel.
Focus on identifying traveler tastes, offering private Nile Dahabiya charters, and delivering bespoke travel experiences.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.5-flash', 'gpt-4o-mini'],
    temperature: 0.6,
    maxTokens: 1000,
    allowedSources: ['tours', 'hotels', 'destinations', 'transportation'],
    allowedTools: ['search_catalog', 'tailor_itinerary'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: false,
    isPublic: true,
  },
  {
    slug: 'egyptologist',
    nameJsonb: {
      en: 'Cultural Heritage & Egyptologist Guide',
      ar: 'المرشد الأثري والمؤرخ الحضاري',
      es: 'Guía Egiptólogo y de Patrimonio Cultural',
      pt: 'Guia Egiptólogo e de Patrimônio Cultural',
      it: 'Guida Egittologo e del Patrimonio Culturale',
    },
    descriptionJsonb: {
      en: 'Rich historical storytelling regarding Pharaohs, pyramids, hieroglyphics, and archaeological discoveries.',
      ar: 'سرد تاريخي موثق عن الفراعنة، الأهرامات، المعابد الفرعونية، وأحدث الاكتشافات الأثرية.',
      es: 'Narrativa histórica sobre faraones, pirámides y descubrimientos arqueológicos.',
      pt: 'Narrativa histórica sobre faraós, pirâmides e descobertas arqueológicas.',
      it: 'Narrazione storica approfondita su faraoni, piramidi e scoperte archeologiche.',
    },
    role: 'Egyptologist',
    avatar: '📜',
    tone: 'Intellectual, Passionate, Engaging & Scholarly',
    personalityGuidelines: 'Bring Egyptian history alive through vivid anecdotes while recommending guided heritage tours.',
    systemPrompt: `You are the Egyptologist & Historian for Dunas Travel.
Bring 5,000 years of ancient history alive and connect monuments to Dunas Travel's guided heritage tours.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.5-flash', 'gpt-4o-mini'],
    temperature: 0.7,
    maxTokens: 1200,
    allowedSources: ['tours', 'destinations'],
    allowedTools: ['search_catalog'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: false,
    isPublic: true,
  },
  {
    slug: 'support_agent',
    nameJsonb: {
      en: 'Customer Care & Official Policy Advisor',
      ar: 'مستشار خدمة العملاء والسياسات الرسمية',
      es: 'Atención al Cliente y Asesor de Políticas',
      pt: 'Atendimento ao Cliente e Consultor de Políticas',
      it: 'Servizio Clienti e Consulente Politiche',
    },
    descriptionJsonb: {
      en: 'Official reference for visa rules, cancellation terms, payment installments, and traveler safety guidelines.',
      ar: 'المرجع الرسمي لمتطلبات التأشيرات، سياسات الإلغاء، شروط الدفع، وإرشادات السلامة.',
      es: 'Referencia oficial sobre visados, políticas de cancelación y pagos.',
      pt: 'Referência oficial sobre vistos, cancelamentos e formas de pagamento.',
      it: 'Riferimento ufficiale per visti, cancellazioni e modalità di pagamento.',
    },
    role: 'Customer Care',
    avatar: '🛡️',
    tone: 'Helpful, Reassuring, Clear & Compliant',
    personalityGuidelines: 'Provide clear, factual assistance regarding travel logistics, booking terms, and safety policies.',
    systemPrompt: `You are the Customer Care Specialist for Dunas Travel.
Help guests with payment policies, visa questions, cancellation rules, and pickup logistics.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.5-flash', 'gpt-4o-mini'],
    temperature: 0.2,
    maxTokens: 800,
    allowedSources: ['policies', 'transportation'],
    allowedTools: ['escalate_to_human', 'search_policies'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: true,
    isPublic: true,
  },
  {
    slug: 'egyptologist',
    nameJsonb: {
      en: 'Historian & Egyptologist',
      ar: 'خبير الآثار والمؤرخ المصري',
      es: 'Historiador y Egiptólogo',
      pt: 'Historiador e Egiptólogo',
      it: 'Storico ed Egittologo',
    },
    descriptionJsonb: {
      en: 'Fascinating archaeological storytelling, hieroglyphic cartouches, pharaonic legacy, and Grand Egyptian Museum insights.',
      ar: 'أسرار الحضارة المصرية القديمة، فك شفرات الهيروغليفية، وتاريخ معابد الفراعنة والمتحف الكبير.',
      es: 'Misterios de los faraones, jeroglíficos y tumbas sagradas de Egipto.',
      pt: 'Histórias arqueológicas, hieróglifos e segredos do Antigo Egito.',
      it: 'Storia archeologica, geroglifici e segreti dell\'Antigo Egitto.',
    },
    role: 'Historian & Egyptologist',
    avatar: '📜',
    tone: 'Passionate, Scholarly, Narrative & Captivating',
    personalityGuidelines: 'Bring 5,000 years of civilization alive. Share historical depth about Karnak, Valley of the Kings, Abu Simbel, and connecting historical wonders to Dunas Travel guided tours.',
    systemPrompt: `You are the Resident Egyptologist for Dunas Travel.
You illuminate the monuments of Egypt with scholarly accuracy, storytelling mastery, and cultural reverence.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    temperature: 0.7,
    maxTokens: 1200,
    allowedSources: ['destinations', 'tours'],
    allowedTools: ['search_catalog', 'translate_hieroglyphics'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: true,
    isPublic: true,
  },
];

@Injectable()
export class AgentRegistryService implements OnModuleInit {
  private readonly logger = new Logger(AgentRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultAgentsSeeded();
    } catch (err: any) {
      this.logger.warn(`Failed to seed AI agent presets (non-fatal): ${err.message}`);
    }

    try {
      await this.backfillEmptyPrompts();
    } catch (err: any) {
      this.logger.warn(`Failed to backfill empty agent prompts (non-fatal): ${err.message}`);
    }

    try {
      await this.ensureSingleActiveAgent();
    } catch (err: any) {
      this.logger.warn(`Failed to sanitize active agents (non-fatal): ${err.message}`);
    }
  }

  async ensureSingleActiveAgent() {
    const activeAgents = await (this.prisma as any).aiAgent.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (activeAgents.length > 1) {
      const [primary, ...rest] = activeAgents;
      const idsToDeactivate = rest.map((a: any) => a.id);
      await (this.prisma as any).aiAgent.updateMany({
        where: { id: { in: idsToDeactivate } },
        data: { isActive: false },
      });
      this.logger.log(`Sanitized active agents: Only '${primary.slug}' is active on website.`);
    } else if (activeAgents.length === 0) {
      await (this.prisma as any).aiAgent.updateMany({
        where: { slug: 'guider' },
        data: { isActive: true },
      });
    }
  }

  async backfillEmptyPrompts() {
    const agentsWithoutPrompt = await (this.prisma as any).aiAgent.findMany({
      where: {
        OR: [
          { systemPrompt: null },
          { systemPrompt: '' },
        ],
      },
    });

    if (agentsWithoutPrompt.length > 0) {
      const currentConfig = await (this.prisma as any).aiConfig.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null);
      for (const agent of agentsWithoutPrompt) {
        const preset = DEFAULT_PRESET_AGENTS.find((p) => p.slug === agent.slug);
        const promptToSet = (agent.isActive && currentConfig?.systemInstructions)
          ? currentConfig.systemInstructions
          : preset?.systemPrompt || currentConfig?.systemInstructions || DEFAULT_PRESET_AGENTS[0].systemPrompt;
        const personalityToSet = (agent.isActive && currentConfig?.salesPersonality)
          ? currentConfig.salesPersonality
          : preset?.personalityGuidelines || currentConfig?.salesPersonality || DEFAULT_PRESET_AGENTS[0].personalityGuidelines;

        await (this.prisma as any).aiAgent.update({
          where: { id: agent.id },
          data: {
            systemPrompt: promptToSet,
            ...(!agent.personalityGuidelines ? { personalityGuidelines: personalityToSet } : {}),
          },
        });
      }
      this.logger.log(`Backfilled ${agentsWithoutPrompt.length} agents with empty system prompts.`);
    }
  }

  async activateSingleAgent(idOrSlug: string) {
    const target = await (this.prisma as any).aiAgent.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
    if (!target) throw new NotFoundException(`Agent '${idOrSlug}' not found.`);

    // 1. Deactivate all agents so only ONE is active
    await (this.prisma as any).aiAgent.updateMany({
      data: { isActive: false },
    });

    // 2. Activate the selected one
    const activated = await (this.prisma as any).aiAgent.update({
      where: { id: target.id },
      data: { isActive: true },
    });

    // 3. Immediately synchronize the system prompt to AiConfig
    if (activated.systemPrompt) {
      const currentConfig = await (this.prisma as any).aiConfig.findFirst({ orderBy: { createdAt: 'desc' } });
      if (currentConfig) {
        await this.prisma.aiConfig.update({
          where: { id: currentConfig.id },
          data: {
            systemInstructions: activated.systemPrompt,
            ...(activated.personalityGuidelines ? { salesPersonality: activated.personalityGuidelines } : {}),
            ...(activated.tone ? { toneOfVoice: activated.tone } : {}),
          },
        });
      }
    }

    return activated;
  }

  async getAllAgents(locale = 'en') {
    const [rows, currentConfig] = await Promise.all([
      (this.prisma as any).aiAgent.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      (this.prisma as any).aiConfig.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null),
    ]);

    return rows.map((agent: any) => {
      const preset = DEFAULT_PRESET_AGENTS.find((p) => p.slug === agent.slug);
      const fallbackPrompt = (agent.isActive && currentConfig?.systemInstructions)
        ? currentConfig.systemInstructions
        : preset?.systemPrompt || currentConfig?.systemInstructions || DEFAULT_PRESET_AGENTS[0].systemPrompt;
      const fallbackPersonality = (agent.isActive && currentConfig?.salesPersonality)
        ? currentConfig.salesPersonality
        : preset?.personalityGuidelines || currentConfig?.salesPersonality || DEFAULT_PRESET_AGENTS[0].personalityGuidelines;

      const resolvedPrompt = (agent.systemPrompt && agent.systemPrompt.trim()) ? agent.systemPrompt : fallbackPrompt;
      const resolvedPersonality = (agent.personalityGuidelines && agent.personalityGuidelines.trim()) ? agent.personalityGuidelines : fallbackPersonality;

      return {
        id: agent.id,
        slug: agent.slug,
        name: agent.nameJsonb?.[locale] || agent.nameJsonb?.en || agent.slug,
        nameJsonb: agent.nameJsonb,
        description: agent.descriptionJsonb?.[locale] || agent.descriptionJsonb?.en || '',
        descriptionJsonb: agent.descriptionJsonb,
        role: agent.role,
        avatar: agent.avatar,
        tone: agent.tone || currentConfig?.toneOfVoice || 'فاخر واحترافي',
        personalityGuidelines: resolvedPersonality,
        systemPrompt: resolvedPrompt,
        primaryModel: agent.primaryModel,
        fallbackModels: agent.fallbackModels,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        allowedSources: agent.allowedSources,
        allowedTools: agent.allowedTools,
        supportedLanguages: agent.supportedLanguages,
        defaultLanguage: agent.defaultLanguage,
        isActive: agent.isActive,
        isPublic: agent.isPublic,
        totalConversations: agent.totalConversations || 0,
        averageRating: agent.averageRating || 5.0,
        createdAt: agent.createdAt?.toISOString(),
        updatedAt: agent.updatedAt?.toISOString(),
      };
    });
  }

  async getAgentBySlug(slug: string, locale?: string) {
    const [agent, currentConfig] = await Promise.all([
      (this.prisma as any).aiAgent.findUnique({
        where: { slug },
      }),
      (this.prisma as any).aiConfig.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null),
    ]);
    if (!agent) {
      throw new NotFoundException(`AI Agent with slug '${slug}' not found.`);
    }

    const preset = DEFAULT_PRESET_AGENTS.find((p) => p.slug === agent.slug);
    const resolvedPrompt = (agent.systemPrompt && agent.systemPrompt.trim())
      || (agent.isActive && currentConfig?.systemInstructions)
      || preset?.systemPrompt
      || currentConfig?.systemInstructions
      || DEFAULT_PRESET_AGENTS[0].systemPrompt;
    const resolvedPersonality = (agent.personalityGuidelines && agent.personalityGuidelines.trim())
      || (agent.isActive && currentConfig?.salesPersonality)
      || preset?.personalityGuidelines
      || currentConfig?.salesPersonality
      || DEFAULT_PRESET_AGENTS[0].personalityGuidelines;

    const loc = (locale || 'en').toLowerCase().split('-')[0];
    const nameMap = (agent.nameJsonb && typeof agent.nameJsonb === 'object') ? agent.nameJsonb : {};
    const descMap = (agent.descriptionJsonb && typeof agent.descriptionJsonb === 'object') ? agent.descriptionJsonb : {};

    return {
      ...agent,
      systemPrompt: resolvedPrompt,
      personalityGuidelines: resolvedPersonality,
      displayName: nameMap[loc] || nameMap.en || agent.slug,
      displayDescription: descMap[loc] || descMap.en || '',
    };
  }

  async createAgent(dto: CreateAgentDto) {
    const created = await (this.prisma as any).aiAgent.create({
      data: {
        slug: dto.slug.toLowerCase().trim(),
        nameJsonb: dto.nameJsonb,
        descriptionJsonb: dto.descriptionJsonb || {},
        role: dto.role,
        avatar: dto.avatar || '🤖',
        systemPrompt: dto.systemPrompt,
        personalityGuidelines: dto.personalityGuidelines,
        tone: dto.tone || 'Refined & Professional',
        primaryModel: dto.primaryModel || 'gemini-3.6-flash',
        fallbackModels: dto.fallbackModels || ['gemini-3.5-flash-lite', 'gpt-4o-mini'],
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1024,
        allowedSources: dto.allowedSources || ['tours', 'destinations', 'policies'],
        allowedTools: dto.allowedTools || ['search_catalog', 'check_availability'],
        supportedLanguages: dto.supportedLanguages || ['en', 'ar', 'es', 'pt', 'it'],
        defaultLanguage: dto.defaultLanguage || 'en',
        isActive: dto.isActive ?? true,
        isPublic: dto.isPublic ?? true,
      },
    });

    return created;
  }

  async updateAgent(id: string, dto: UpdateAgentDto) {
    const existing = await (this.prisma as any).aiAgent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Agent '${id}' not found.`);
    }

    const updated = await (this.prisma as any).aiAgent.update({
      where: { id },
      data: {
        nameJsonb: dto.nameJsonb ?? existing.nameJsonb,
        descriptionJsonb: dto.descriptionJsonb ?? existing.descriptionJsonb,
        role: dto.role ?? existing.role,
        avatar: dto.avatar ?? existing.avatar,
        systemPrompt: dto.systemPrompt !== undefined ? dto.systemPrompt : existing.systemPrompt,
        personalityGuidelines: dto.personalityGuidelines !== undefined ? dto.personalityGuidelines : existing.personalityGuidelines,
        tone: dto.tone ?? existing.tone,
        primaryModel: dto.primaryModel ?? existing.primaryModel,
        fallbackModels: dto.fallbackModels ?? existing.fallbackModels,
        temperature: dto.temperature ?? existing.temperature,
        maxTokens: dto.maxTokens ?? existing.maxTokens,
        allowedSources: dto.allowedSources ?? existing.allowedSources,
        allowedTools: dto.allowedTools ?? existing.allowedTools,
        supportedLanguages: dto.supportedLanguages ?? existing.supportedLanguages,
        defaultLanguage: dto.defaultLanguage ?? existing.defaultLanguage,
        isActive: dto.isActive ?? existing.isActive,
        isPublic: dto.isPublic ?? existing.isPublic,
        activePromptVersionId: dto.activePromptVersionId ?? existing.activePromptVersionId,
      },
    });

    // If updated agent is active on the website and systemPrompt was provided, synchronize to live AiConfig immediately
    if (updated.isActive && updated.systemPrompt) {
      const currentConfig = await (this.prisma as any).aiConfig.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null);
      if (currentConfig) {
        await this.prisma.aiConfig.update({
          where: { id: currentConfig.id },
          data: {
            systemInstructions: updated.systemPrompt,
            ...(updated.personalityGuidelines ? { salesPersonality: updated.personalityGuidelines } : {}),
            ...(updated.tone ? { toneOfVoice: updated.tone } : {}),
          },
        });
      }
    }

    return updated;
  }

  async deleteAgent(id: string) {
    const existing = await (this.prisma as any).aiAgent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Agent '${id}' not found.`);
    }

    // Do not allow deleting core 'guider'
    if (existing.slug === 'guider') {
      throw new Error('The primary default GuideR agent cannot be deleted.');
    }

    await (this.prisma as any).aiAgent.delete({ where: { id } });
    return { success: true, id };
  }

  async ensureDefaultAgentsSeeded() {
    try {
      const count = await (this.prisma as any).aiAgent.count();
      if (count === 0) {
        this.logger.log('Seeding initial 5 core luxury AI agents...');
        for (const preset of DEFAULT_PRESET_AGENTS) {
          await (this.prisma as any).aiAgent.upsert({
            where: { slug: preset.slug },
            create: {
              slug: preset.slug,
              nameJsonb: preset.nameJsonb,
              descriptionJsonb: preset.descriptionJsonb || {},
              role: preset.role,
              avatar: preset.avatar,
              tone: preset.tone,
              personalityGuidelines: preset.personalityGuidelines,
              systemPrompt: preset.systemPrompt,
              primaryModel: preset.primaryModel,
              fallbackModels: preset.fallbackModels,
              temperature: preset.temperature,
              maxTokens: preset.maxTokens,
              allowedSources: preset.allowedSources,
              allowedTools: preset.allowedTools,
              supportedLanguages: preset.supportedLanguages,
              defaultLanguage: preset.defaultLanguage,
              isActive: preset.isActive,
              isPublic: preset.isPublic,
            },
            update: {},
          });
        }
        this.logger.log('5 default luxury AI agents seeded successfully.');
      }
    } catch (e: any) {
      this.logger.warn(`Could not seed default agents: ${e.message}`);
    }
  }
}
