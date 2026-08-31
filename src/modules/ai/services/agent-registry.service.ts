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
4. For custom multi-day plans, provide structured day-by-day itineraries with private transfers, 5-star accommodations, and private Egyptologist guides.`,
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
    isActive: true,
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
      en: 'High-touch advisor for private jet charters, luxury dahabiya buyouts, and bespoke VIP delegations.',
      ar: 'مستشار خاص للرحلات المصممة بالكامل، تأجير الطائرات الخاصة، والدهبيات النيلية الحصرية.',
      es: 'Asesor exclusivo para vuelos privados, alquiler de dahabiyas y viajes a medida.',
      pt: 'Consultor exclusivo para jatos privados, dahabiyas exclusivas e roteiros sob medida.',
      it: 'Consulente esclusivo per voli privati, noleggio dahabiya e delegazioni VIP.',
    },
    role: 'Sales Concierge',
    avatar: '💎',
    tone: 'Persuasive, Discerning, Ultra-Exclusive & Attentive',
    personalityGuidelines: 'Focus on high-ticket custom offerings: private dahabiyas (e.g. 5-cabin private yacht charters), presidential palace hotel suites, private archaeological permits.',
    systemPrompt: `You are the VIP & Tailor-Made Sales Consultant for Dunas Travel.
You curate bespoke journeys for high-net-worth individuals, families, and delegations seeking uncompromised privacy and elegance.`,
    primaryModel: 'gemini-3.7-flash',
    fallbackModels: ['gemini-3.5-flash', 'gpt-4o'],
    temperature: 0.7,
    maxTokens: 1500,
    allowedSources: ['tours', 'destinations', 'hotels', 'transportation'],
    allowedTools: ['tailor_itinerary', 'qualify_lead', 'search_catalog'],
    supportedLanguages: ['en', 'ar', 'es', 'pt', 'it'],
    defaultLanguage: 'en',
    isActive: true,
    isPublic: true,
  },
  {
    slug: 'support_agent',
    nameJsonb: {
      en: 'Customer Care & Policy Advisor',
      ar: 'مستشار خدمة العملاء والسياسات الرسمية',
      es: 'Asesor de Atención al Cliente y Políticas',
      pt: 'Consultor de Atendimento e Políticas',
      it: 'Consulente Assistenza e Normative',
    },
    descriptionJsonb: {
      en: 'Authoritative guidance on payment terms, deposits, cancellation policies, and airport meet-and-assist.',
      ar: 'المصدر الرسمي لسياسات الدفع المعتمدة، شروط الإلغاء والاسترداد، وإرشادات التأشيرة والاستقبال.',
      es: 'Información oficial sobre pagos, depósitos, cancelación y visados.',
      pt: 'Orientação oficial sobre pagamentos, depósitos, cancelamento e vistos.',
      it: 'Informazioni ufficiali su pagamentos, depositi, cancellazione e visti.',
    },
    role: 'Support & Policy Advisor',
    avatar: '🛡️',
    tone: 'Clear, Calming, Authoritative & Helpful',
    personalityGuidelines: 'Answer policy questions transparently using official policy documents. If traveler requests urgent cancellation or refund dispute, smoothly initiate human staff escalation.',
    systemPrompt: `You are the Customer Care & Policy Advisor for Dunas Travel.
You provide clear, accurate guidance on official Dunas Travel booking terms, GetPayIn hosted payment checkout, deposit schedules, and cancellation policies.`,
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
  }

  async getAllAgents(locale = 'en') {
    const rows = await (this.prisma as any).aiAgent.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((agent: any) => ({
      id: agent.id,
      slug: agent.slug,
      name: agent.nameJsonb?.[locale] || agent.nameJsonb?.en || agent.slug,
      nameJsonb: agent.nameJsonb,
      description: agent.descriptionJsonb?.[locale] || agent.descriptionJsonb?.en || '',
      descriptionJsonb: agent.descriptionJsonb,
      role: agent.role,
      avatar: agent.avatar,
      tone: agent.tone,
      personalityGuidelines: agent.personalityGuidelines,
      systemPrompt: agent.systemPrompt,
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
    }));
  }

  async getAgentBySlug(slug: string, locale?: string) {
    const agent = await (this.prisma as any).aiAgent.findUnique({
      where: { slug },
    });
    if (!agent) {
      throw new NotFoundException(`AI Agent with slug '${slug}' not found.`);
    }
    if (locale) {
      const loc = (locale || 'en').toLowerCase().split('-')[0];
      const nameMap = (agent.nameJsonb && typeof agent.nameJsonb === 'object') ? agent.nameJsonb : {};
      const descMap = (agent.descriptionJsonb && typeof agent.descriptionJsonb === 'object') ? agent.descriptionJsonb : {};
      return {
        ...agent,
        displayName: nameMap[loc] || nameMap.en || agent.slug,
        displayDescription: descMap[loc] || descMap.en || '',
      };
    }
    return agent;
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
        systemPrompt: dto.systemPrompt ?? existing.systemPrompt,
        personalityGuidelines: dto.personalityGuidelines ?? existing.personalityGuidelines,
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
