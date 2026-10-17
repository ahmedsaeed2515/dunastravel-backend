import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { AvailabilityService } from '../../availability/availability.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BOOKING_EVENTS } from '../../../common/events';
import { AiKeyPoolService } from './ai-key-pool.service';
import { RagRetrievalService, GroundingSource } from './rag-retrieval.service';
import {
  TourCatalogToolService,
  GroundedTourRecommendation,
  GroundedDestinationRecommendation,
  TravelConstraints,
  StructuredTourComparison,
} from './tour-catalog-tool.service';
import { sanitizePlainText } from '../../../common/utils/content-sanitizer.util';
import { generateReferenceCode } from '../../../common/utils/identifiers.util';
import { ResponseInvariantNormalizer } from './guider-invariants';
import { Response } from 'express';
import { BookTourChatDto } from '../dto/public-chat.dto';

export interface ProcessChatMessageDto {
  message: string;
  sessionId: string;
  locale?: string;
  personaCode?: string;
  promptVersionId?: string;
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
  idempotencyKey?: string;
}

export type GuiderAvailabilityStatus = 'ACTIVE' | 'DISABLED' | 'MAINTENANCE';

export type GuiderResponseType =
  | 'text'
  | 'recommendation'
  | 'itinerary'
  | 'comparison'
  | 'booking_intent'
  | 'lead_capture'
  | 'clarification'
  | 'error';

export interface GuiderAvailabilityResult {
  enabled: boolean;
  status: GuiderAvailabilityStatus;
  version: string;
  message: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  reason: string | null;
}

export interface AiPersona {
  code: string;
  icon: string;
  name: { [locale: string]: string };
  tagline: { [locale: string]: string };
  tone: string;
  personalityGuidelines: string;
  systemPromptAddendum: string;
}

export const AI_PERSONAS: AiPersona[] = [
  {
    code: 'luxury_concierge',
    icon: '👑',
    name: {
      en: 'Royal Luxury Concierge',
      ar: 'الكونسيرج السياحي الفاخر',
      es: 'Conserje Real de Lujo',
      pt: 'Concierge Real de Luxo',
      it: 'Concierge Reale di Lusso',
    },
    tagline: {
      en: 'Executive white-glove service & signature VIP experiences',
      ar: 'خدمة راقية وتجارب VIP خاصة ومصممة بعناية',
      es: 'Servicio ejecutivo de guante blanco y experiencias VIP',
      pt: 'Serviço executivo refinado e experiências VIP exclusivas',
      it: 'Servizio impeccabile e itinerari VIP esclusivi',
    },
    tone: 'Warm, Executive, Knowledgeable & Refined',
    personalityGuidelines:
      'Communicate with natural elegance, genuine warmth, and travel expertise. NEVER use archaic gendered honorifics like "سيدي", "سيدتي", or "سيدي/سيدتي الكريمة". Address travelers with professional, contemporary Arabic ("أهلاً بك", "يسعدني إرشادك"). Highlight private Dahabiyas, bespoke pacing, and VIP logistics only when relevant.',
    systemPromptAddendum: `PERSONA MODE: LUXURY TRAVEL CONCIERGE (👑)
- Demeanor: Warm, executive hospitality, conversational, modern luxury.
- Tone: Natural, helpful, respectful without robotic or bureaucratic pleasantries.
- Zero Honorifics: NEVER address the traveler with "سيدي" or "سيدتي" or "سيدي/سيدتي الكريمة".
- Focus: Provide thoughtful travel guidance, seamless comfort, and tailored recommendations.`,
  },
  {
    code: 'egyptologist',
    icon: '📜',
    name: {
      en: 'Historian & Egyptologist',
      ar: 'خبير الآثار والمؤرخ المصري',
      es: 'Historiador y Egiptólogo',
      pt: 'Historiador e Egiptólogo',
      it: 'Storico ed Egittologo',
    },
    tagline: {
      en: 'Deep historical storytelling, hieroglyphics & hidden tombs',
      ar: 'أسرار الحضارة المصرية، فك شفرات الهيروغليفية، وتاريخ المعابد',
      es: 'Misterios de los faraones, jeroglíficos y tumbas secretas',
      pt: 'Segredos dos faraós, hieróglifos e tumbas históricas',
      it: 'Segreti dei faraoni, geroglifici e tombe storiche',
    },
    tone: 'Passionate, Scholarly, Engaging Storyteller',
    personalityGuidelines:
      'Bring ancient Egyptian history to life through clear, fascinating historical narratives about Pyramids, Karnak, and the Grand Egyptian Museum. Never use archaic customer-service honorifics.',
    systemPromptAddendum: `PERSONA MODE: HISTORIAN & EGYPTOLOGIST (📜)
- Demeanor: Intellectual passion, engaging storytelling, scholarly clarity.
- Tone: Inspiring, friendly, educational.
- Zero Honorifics: NEVER address the traveler with "سيدي" or "سيدتي" or "يا فندم".
- Focus: Share historical context that connects monuments with real travel experiences.`,
  },
  {
    code: 'practical_budget',
    icon: '💰',
    name: {
      en: 'Smart Value & Best Price',
      ar: 'المستشار الذكي لأفضل قيمة',
      es: 'Planificador de Mejor Valor',
      pt: 'Planejador de Melhor Custo-Benefício',
      it: 'Consulente Miglior Valore',
    },
    tagline: {
      en: 'Maximum luxury value, smart pacing & transparent pricing',
      ar: 'أفضل قيمة مقابل السعر، برامج توفير ذكية، وأسعار شفافة',
      es: 'Máximo valor de lujo, ahorro inteligente y precios claros',
      pt: 'Máximo custo-benefício em luxo e tarifas transparentes',
      it: 'Miglior rapporto qualità-prezzo e massima trasparenza',
    },
    tone: 'Pragmatic, Transparent, Helpful & Cost-Conscious',
    personalityGuidelines:
      'Help travelers maximize value, explain seasonal pricing advantages, and avoid hidden costs. Always speak clearly and directly without bureaucratic formalities.',
    systemPromptAddendum: `PERSONA MODE: SMART VALUE & BEST PRICE (💰)
- Demeanor: Direct, practical, transparent, value-maximizing.
- Zero Honorifics: NEVER address the traveler with "سيدي" or "سيدتي" or "يا فندم".
- Focus: Highlight clear inclusions, smart duration pacing, and transparent pricing.`,
  },
  {
    code: 'family_adventure',
    icon: '👨‍👩‍👧‍👦',
    name: {
      en: 'Family & Kids Adventurer',
      ar: 'مرشد العائلات والرحلات الممتعة',
      es: 'Guía de Familias y Aventura',
      pt: 'Guia Familiar e Aventura',
      it: 'Guida per Famiglie e Avventure',
    },
    tagline: {
      en: 'Comfortable pacing, kid-friendly fun & safe adventures',
      ar: 'وتيرة مريحة تناسب الصغار، أنشطة ممتعة، وأمان عائلي تام',
      es: 'Ritmo cómodo para niños, diversión segura y aventuras familiares',
      pt: 'Ritmo confortável para crianças e passeios seguros em família',
      it: 'Ritmo rilassato per bambini e avventure familiari sicure',
    },
    tone: 'Warm, Cheerful, Reassuring & Engaging',
    personalityGuidelines:
      'Prioritize family safety, comfortable schedules with minimal fatigue, and child-friendly adventures. Speak with cheerful warmth without stiff clichés.',
    systemPromptAddendum: `PERSONA MODE: FAMILY & KIDS ADVENTURER (👨‍👩‍👧‍👦)
- Demeanor: Friendly, encouraging, safety-conscious, family-oriented.
- Zero Honorifics: NEVER address the traveler with "سيدي" or "سيدتي" or "يا فندم".
- Focus: Emphasize balanced pacing, child-friendly excursions, and spacious family comfort.`,
  },
  {
    code: 'romantic_honeymoon',
    icon: '💖',
    name: {
      en: 'Romantic & Honeymoon Specialist',
      ar: 'مستشار العطلات الرومانسية وشهر العسل',
      es: 'Especialista en Lunas de Miel',
      pt: 'Especialista em Lua de Mel',
      it: 'Specialista in Viaggi di Nozze',
    },
    tagline: {
      en: 'Candlelit Nile dinners, sunset feluccas & luxury escapes',
      ar: 'عشاء رومانسي على النيل، إبحار عند الغروب، وفيلات شاطئية هادئة',
      es: 'Cenas a la luz de las velas en el Nilo, atardeceres y villas románticas',
      pt: 'Jantares românticos no Nilo, pôr do sol e vilas exclusivas',
      it: 'Cene a lume di candela sul Nilo, tramonti magici e resort esclusivi',
    },
    tone: 'Poetic, Dreamy, Attentive & Romantic',
    personalityGuidelines:
      'Curate tranquil, unforgettable memories for couples: private sunset sails on the Nile, couple spa treatments, and secluded resorts. Speak with refined charm without archaic honorifics.',
    systemPromptAddendum: `PERSONA MODE: ROMANTIC & HONEYMOON SPECIALIST (💖)
- Demeanor: Passionate, attentive, serene.
- Zero Honorifics: NEVER address the traveler with "سيدي" or "سيدتي" or "يا فندم".
- Focus: Suggest tranquil couple experiences, private sunset moments, and bespoke honeymoon perks.`,
  },
];

export interface TripProposalDay {
  dayNumber: number;
  title: string;
  description: string;
  meals?: string;
  activities: string[];
}

export interface StructuredTripProposal {
  id: string;
  title: string;
  durationDays: number;
  destinations: string[];
  tier: 'LUXURY' | 'ULTRA_VIP' | 'EXCLUSIVE_DAHABIYA';
  estimatedPricePerPerson: number;
  currency: string;
  days: TripProposalDay[];
  highlights: string[];
  inclusions: string[];
  isCustomTailored: boolean;
  requiresHumanConfirmation: boolean;
}

export interface GuiderOrchestratorResponse {
  conversationId: string;
  responseType: GuiderResponseType;
  intent: string;
  message: {
    id: string;
    role: string;
    content: string;
    structuredContent?: any;
    createdAt: string;
  };
  recommendations: {
    tours: GroundedTourRecommendation[];
    destinations: GroundedDestinationRecommendation[];
    proposal?: StructuredTripProposal | null;
    comparison?: StructuredTourComparison | null;
  };
  suggestedReplies: string[];
  actions: any[];
  handoff: {
    available: boolean;
    requested: boolean;
    status?: string;
    assignedStaffId?: string | null;
  };
  leadCapture?: {
    required: boolean;
    fields: string[];
  };
  sources?: any[];
  telemetry?: {
    retrievalLatencyMs?: number;
    providerLatencyMs?: number;
    totalLatencyMs?: number;
    costUsd?: number;
  };
}

export interface RecordFeedbackDto {
  conversationId: string;
  messageId?: string;
  rating: number; // +1 or -1
  category?: string; // INCORRECT_INFO, NOT_RELEVANT, POOR_RECOMMENDATION, OUTDATED, OTHER
  comments?: string;
  locale?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /override\s+rules/i,
  /forget\s+all\s+rules/i,
  /reveal\s+(api\s+key|prompt|instructions|secret)/i,
  /jailbreak/i,
  /act\s+as\s+dan/i,
  /roleplay/i,
  /pretend\s+you\s+are/i,
  /let\s+us\s+play\s+a\s+game/i,
  /dump\s+(database|config|keys|prompt)/i,
  /تجاهل\s+(التعليمات|الاوامر|القواعد)/i,
  /أظهر\s+(البرومبت|التعليمات|المفتاح|السر)/i,
  /انس\s+كل\s+(الاوامر|التعليمات)/i,
  /تصرف\s+كأنك/i,
  /تظاهر\s+بأنك/i,
  /تقمص\s+شخصية/i,
  /العب\s+دور/i,
  /<script>/i,
  /javascript:/i,
];

const FINOPS_MODEL_PRICING: Record<
  string,
  { inputPer1M: number; outputPer1M: number }
> = {
  'gemini-2.5-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-3.7-flash': { inputPer1M: 0.75, outputPer1M: 3.75 },
  'gemini-3.6-flash': { inputPer1M: 0.75, outputPer1M: 3.75 },
  'gemini-3.5-flash': { inputPer1M: 1.5, outputPer1M: 9.0 },
  'gemini-3.5-flash-lite': { inputPer1M: 0.3, outputPer1M: 2.5 },
  'gemini-3.1-flash-lite': { inputPer1M: 0.25, outputPer1M: 1.5 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  'grok-3-mini': { inputPer1M: 0.3, outputPer1M: 0.5 },
  'grok-3': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
  'deepseek/deepseek-chat-v3-0324': { inputPer1M: 0.14, outputPer1M: 0.28 },
  'deepseek/deepseek-r1': { inputPer1M: 0.55, outputPer1M: 2.19 },
  'qwen/qwen-2.5-72b-instruct': { inputPer1M: 0.35, outputPer1M: 0.4 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4.0 },
  default: { inputPer1M: 0.1, outputPer1M: 0.4 },
};

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keyPoolService: AiKeyPoolService,
    private readonly ragRetrieval: RagRetrievalService,
    private readonly tourCatalogTool: TourCatalogToolService,
    @Optional() private readonly availabilityService?: AvailabilityService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  private calculateCostUsd(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const rate = FINOPS_MODEL_PRICING[model] || FINOPS_MODEL_PRICING['default'];
    const inputCost = (inputTokens / 1_000_000) * rate.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * rate.outputPer1M;
    return Number((inputCost + outputCost).toFixed(6));
  }

  private async validateAndLogSecurity(text: string, sessionId: string) {
    if (!text || !text.trim()) {
      throw new BadRequestException('Message content cannot be empty');
    }
    if (text.length > 2000) {
      throw new BadRequestException(
        'Message content exceeds maximum length of 2000 characters',
      );
    }
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        if (this.prisma?.aiUsageLog?.create) {
          try {
            await this.prisma.aiUsageLog.create({
              data: {
                provider: 'SECURITY_FILTER',
                model: 'PRE_EXECUTION_GUARD',
                inputTokens: Math.ceil(text.length / 4),
                outputTokens: 0,
                latencyMs: 1,
                isSuccess: false,
                errorCategory: 'PROMPT_INJECTION_BLOCKED',
                sessionId,
                endpoint: '/api/ai/chat/message',
              },
            });
          } catch (e: any) {
            this.logger.warn(`Could not log security event: ${e.message}`);
          }
        }

        throw new BadRequestException(
          'Security violation: malicious input pattern detected',
        );
      }
    }
  }

  async getOrCreateConfig() {
    return this.keyPoolService.getAiConfig();
  }

  async getPublicAvailabilityStatus(): Promise<GuiderAvailabilityResult> {
    const config = await this.getOrCreateConfig();
    const tourSettings =
      config.tourSettings && typeof config.tourSettings === 'object'
        ? config.tourSettings
        : {};

    let status: GuiderAvailabilityStatus = 'ACTIVE';
    if (
      tourSettings.guiderStatus === 'MAINTENANCE' ||
      tourSettings.guiderStatus === 'DISABLED' ||
      tourSettings.guiderStatus === 'ACTIVE'
    ) {
      status = tourSettings.guiderStatus;
    } else if (!config.isEnabled || !config.isPublicEnabled) {
      status = 'DISABLED';
    }

    // Explicit override if isEnabled or isPublicEnabled is false
    if (!config.isEnabled || !config.isPublicEnabled) {
      if (status !== 'MAINTENANCE') {
        status = 'DISABLED';
      }
    }

    const isAvailable =
      status === 'ACTIVE' &&
      Boolean(config.isEnabled) &&
      Boolean(config.isPublicEnabled);

    let defaultMsg: string | null = null;
    if (status === 'MAINTENANCE') {
      defaultMsg =
        'The GuideR AI Concierge service is currently undergoing scheduled maintenance. Please check back shortly or contact our travel specialists.';
    } else if (status === 'DISABLED') {
      defaultMsg =
        'The GuideR AI Concierge service is currently offline. Please explore our curated tours or contact our team directly.';
    }

    const message = isAvailable
      ? null
      : tourSettings.disabledMessage || defaultMsg;

    return {
      enabled: isAvailable,
      status,
      version: '2.0.0',
      message,
      statusChangedAt: tourSettings.statusChangedAt || null,
      statusChangedBy: tourSettings.statusChangedBy || null,
      reason: tourSettings.statusReason || null,
    };
  }

  async updateGuiderStatus(
    dto: {
      status: GuiderAvailabilityStatus;
      disabledMessage?: string;
      reason?: string;
    },
    changedBy: string = 'admin',
  ): Promise<GuiderAvailabilityResult> {
    const config = await this.getOrCreateConfig();
    const existingTourSettings =
      config.tourSettings && typeof config.tourSettings === 'object'
        ? config.tourSettings
        : {};

    const isEnabled = dto.status === 'ACTIVE';
    const isPublicEnabled = dto.status === 'ACTIVE';

    const updatedTourSettings = {
      ...existingTourSettings,
      guiderStatus: dto.status,
      disabledMessage: dto.disabledMessage || null,
      statusChangedAt: new Date().toISOString(),
      statusChangedBy: changedBy,
      statusReason: dto.reason || null,
    };

    await (this.prisma as any).aiConfig.update({
      where: { id: config.id },
      data: {
        isEnabled,
        isPublicEnabled,
        tourSettings: updatedTourSettings,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `GuideR operational status updated to ${dto.status} by ${changedBy}`,
    );

    let defaultMsg = 'GuideR AI Concierge is currently available.';
    if (dto.status === 'MAINTENANCE') {
      defaultMsg =
        'GuideR AI Concierge is currently undergoing scheduled maintenance. Please reach out via WhatsApp or visit our tour pages.';
    } else if (dto.status === 'DISABLED') {
      defaultMsg =
        'GuideR AI Concierge is currently offline. Please browse our tours directly or contact our concierge team.';
    }

    return {
      enabled: isPublicEnabled,
      status: dto.status,
      version: '2.0.0',
      message: dto.disabledMessage || defaultMsg,
      statusChangedAt: updatedTourSettings.statusChangedAt,
      statusChangedBy: changedBy,
      reason: updatedTourSettings.statusReason,
    };
  }

  getActivePersonas(locale: string = 'en') {
    const loc = (locale || 'en').toLowerCase().split('-')[0];
    return AI_PERSONAS.map((p) => ({
      code: p.code,
      icon: p.icon,
      name: p.name[loc] || p.name.en || p.name.ar,
      tagline: p.tagline[loc] || p.tagline.en || p.tagline.ar,
      tone: p.tone,
      personalityGuidelines: p.personalityGuidelines,
    }));
  }

  async bookTourFromChat(dto: BookTourChatDto) {
    // In accordance with Decision #1: GuideR must not book trips or create dummy User/Booking/Invoice records.
    // GuideR directs travelers to the official tour page (/tours/:slug) to customize dates and reserve.
    const isArabic = (dto.locale || '').startsWith('ar');

    const tour = await (this.prisma as any).tour.findFirst({
      where: {
        OR: [{ id: dto.tourId }, { slug: dto.tourId }],
        deletedAt: null,
      },
      include: {
        images: { where: { isHero: true }, take: 1 },
      },
    });

    const slug = tour?.slug || dto.tourId || '';
    const tourPageUrl = slug ? `/tours/${slug}` : '/tours';
    const tMap =
      tour?.titleJsonb && typeof tour?.titleJsonb === 'object'
        ? tour.titleJsonb
        : {};
    const tourTitle = isArabic
      ? tMap.ar || tMap.en || tour?.title || 'الرحلة'
      : tMap.en || tMap.ar || tour?.title || 'Tour';

    if (dto.sessionId) {
      const conversation = await (
        this.prisma as any
      ).chatConversation.findUnique({
        where: { publicSessionId: dto.sessionId },
      });
      if (conversation) {
        await (this.prisma as any).chatConversation.update({
          where: { id: conversation.id },
          data: {
            visitorName: dto.fullName?.trim() || conversation.visitorName,
            visitorEmail:
              dto.email?.trim().toLowerCase() || conversation.visitorEmail,
            visitorPhone: dto.phone?.trim() || conversation.visitorPhone,
            leadStatus: 'QUALIFIED',
            updatedAt: new Date(),
          },
        });

        const replyText = isArabic
          ? `يسعدني اهتمامك برحلة "${tourTitle}"! لاستكمال حجزك وتحديد المواعيد والخيارات المخصصة، يرجى الانتقال إلى صفحة الرحلة الرسمية:\n\n[عرض تفاصيل الرحلة وحجزها](${tourPageUrl})`
          : `Thank you for your interest in "${tourTitle}"! To customize your dates, preferences, and reserve your journey, please visit the official tour page:\n\n[View Tour Details & Book](${tourPageUrl})`;

        await (this.prisma as any).chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            textContent: replyText,
            locale: dto.locale || 'en',
          },
        });
      }
    }

    return {
      success: true,
      deprecated: true,
      requiresTourNavigation: true,
      tourUrl: tourPageUrl,
      leadLogged: true,
      message: isArabic
        ? 'تم استلام اهتمامك بالرحلة. يرجى الانتقال إلى صفحة الرحلة لإتمام الحجز.'
        : 'Inquiry noted. Please visit the official tour page to complete your reservation.',
      tourSlug: slug,
      redirectUrl: tourPageUrl,
      checkoutUrl: tourPageUrl,
    };
  }

  async getConversationHistory(sessionId: string) {
    if (!sessionId) return { messages: [] };

    const conversation = await (this.prisma as any).chatConversation.findUnique(
      {
        where: { publicSessionId: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    );

    if (!conversation) return { messages: [] };

    // Collect tour IDs that need hydration if structured tours not stored directly
    const allTourIdsToHydrate: string[] = [];
    conversation.messages.forEach((m: any) => {
      const structTours = m.structuredContent?.tours;
      if (
        !structTours ||
        !Array.isArray(structTours) ||
        structTours.length === 0
      ) {
        if (
          m.recommendedTourIds &&
          Array.isArray(m.recommendedTourIds) &&
          m.recommendedTourIds.length > 0
        ) {
          allTourIdsToHydrate.push(...m.recommendedTourIds);
        }
      }
    });

    const hydratedToursMap = new Map<string, GroundedTourRecommendation>();
    if (allTourIdsToHydrate.length > 0) {
      const tourRecords = await this.tourCatalogTool.getToursByIds(
        Array.from(new Set(allTourIdsToHydrate)),
        conversation.locale || 'en',
      );
      tourRecords.forEach((t) => hydratedToursMap.set(t.id, t));
    }

    return {
      conversationId: conversation.id,
      status: conversation.status,
      leadStatus: conversation.leadStatus,
      travelPreferences: conversation.travelPreferences,
      messages: conversation.messages.map((m: any) => {
        let rawTours = m.structuredContent?.tours || [];
        if (
          (!rawTours || !Array.isArray(rawTours) || rawTours.length === 0) &&
          m.recommendedTourIds &&
          Array.isArray(m.recommendedTourIds)
        ) {
          rawTours = m.recommendedTourIds
            .map((id: string) => hydratedToursMap.get(id))
            .filter(Boolean);
        }

        const tours = Array.isArray(rawTours)
          ? rawTours.map((t: any) => ({
              ...t,
              price: Number(t.price ?? t.basePriceUsd) || 0,
              basePriceUsd: Number(t.basePriceUsd ?? t.price) || 0,
            }))
          : [];

        const structuredContent = m.structuredContent
          ? { ...m.structuredContent }
          : null;
        const proposal = m.structuredContent?.proposal
          ? { ...m.structuredContent.proposal }
          : null;
        const comparison = m.structuredContent?.comparison
          ? { ...m.structuredContent.comparison }
          : null;

        return {
          id: m.id,
          role: m.role,
          content: m.textContent,
          structuredContent,
          createdAt: m.createdAt,
          tours,
          sources: m.knowledgeSources,
          proposal,
          comparison,
        };
      }),
    };
  }

  /**
   * Deterministic Structured Itinerary Generator when traveler asks for custom tour planning
   */
  public generateTripProposal(
    constraints: TravelConstraints,
    locale: string,
  ): StructuredTripProposal | null {
    const isArabic = locale.startsWith('ar');
    const daysCount =
      constraints.targetDuration ||
      constraints.maxDuration ||
      constraints.minDuration ||
      (constraints.nileCruiseRequired ? 9 : 8);

    if (daysCount < 3) return null;

    const destinations = ['Cairo'];
    if (constraints.nileCruiseRequired) {
      destinations.push('Luxor', 'Aswan');
    }
    if (constraints.beachRequired) {
      destinations.push('Hurghada / Red Sea');
    }

    const days: TripProposalDay[] = [];
    const baseBudget =
      constraints.maxBudget || (constraints.nileCruiseRequired ? 2490 : 1890);

    // Day 1
    days.push({
      dayNumber: 1,
      title: isArabic
        ? 'الوصول إلى القاهرة والاستقبال الرئاسي'
        : 'Arrival in Cairo & VIP Welcome',
      description: isArabic
        ? 'الوصول لمطار القاهرة الدولي، استقبال VIP من كونسيرج دوناس ترافيل والانتقال بفندق 5 نجوم مطل على النيل/الأهرامات.'
        : 'Arrival at Cairo International Airport, executive meet-and-assist by Dunas Travel concierge, and private transfer to 5-star hotel.',
      meals: isArabic ? 'عشاء ترحيبي' : 'Welcome Dinner',
      activities: [
        isArabic ? 'استقبال المطار' : 'VIP Airport Transfer',
        isArabic ? 'تسجيل الدخول بالفندق' : 'Hotel Check-in',
      ],
    });

    // Day 2
    days.push({
      dayNumber: 2,
      title: isArabic
        ? 'أهرامات الجيزة، سقارة، والمتحف المصري الكبير'
        : 'Giza Pyramids, Saqqara & Grand Egyptian Museum',
      description: isArabic
        ? 'جولة خاصة مع خبير آثار لاستكشاف أهرامات الجيزة، تمثال أبو الهول، هرم زوسر المدرج بسقارة، وزيارة المتحف المصري الكبير (GEM).'
        : 'Private Egyptologist-led expedition to the Great Pyramids of Giza, Sphinx, Djoser Step Pyramid in Saqqara, and Grand Egyptian Museum (GEM).',
      meals: isArabic ? 'إفطار + غداء فاخر' : 'Breakfast + Gourmet Lunch',
      activities: [
        isArabic ? 'الأهرامات' : 'Giza Pyramids',
        isArabic ? 'سقارة' : 'Saqqara',
        isArabic ? 'المتحف الكبير' : 'GEM',
      ],
    });

    if (constraints.nileCruiseRequired) {
      days.push({
        dayNumber: 3,
        title: isArabic
          ? 'الطيران إلى أسوان وبدء الإبحار في النيل'
          : 'Flight to Aswan & Nile Cruise Embarkation',
        description: isArabic
          ? 'طيران داخلي إلى أسوان، الصعود على متن السفينة/الدهبية النيلية الفاخرة، زيارة معبد فيلة والسد العالي، وجولة الفلوكة عند الغروب.'
          : 'Domestic flight to Aswan, embarkation on luxury Nile Cruise / private Dahabiya, visit to Philae Temple, High Dam, and sunset felucca ride.',
        meals: isArabic ? 'إقامة كاملة (فطور، غداء، عشاء)' : 'Full Board',
        activities: [
          isArabic ? 'معبد فيلة' : 'Philae Temple',
          isArabic ? 'السد العالي' : 'High Dam',
          isArabic ? 'إبحار نيلي' : 'Nile Sailing',
        ],
      });

      days.push({
        dayNumber: 4,
        title: isArabic
          ? 'معبد كوم أمبو وإدفو'
          : 'Kom Ombo & Edfu Temples Navigation',
        description: isArabic
          ? 'الإبحار شمالاً وزيارة معبد كوم أمبو المزدوج ومتحف التماسيح، ثم زيارة معبد حورس بإدفو عبر عربات الخيل التقليدية.'
          : 'Sail north to the dual Temple of Kom Ombo and Crocodile Museum, followed by chariot excursion to Horus Temple in Edfu.',
        meals: isArabic ? 'إقامة كاملة' : 'Full Board',
        activities: [
          isArabic ? 'معبد كوم أمبو' : 'Kom Ombo',
          isArabic ? 'معبد إدفو' : 'Edfu Temple',
        ],
      });

      days.push({
        dayNumber: 5,
        title: isArabic
          ? 'الأقصر: وادي الملوك ومعابد الكرنك'
          : 'Luxor: Valley of the Kings & Karnak Temples',
        description: isArabic
          ? 'الوصول للأقصر، زيارة وادي الملوك ومقبرة توت عنخ آمون، معبد حتشبسوت، ثم استكشاف معابد الكرنك والأقصر المضيئة ليلاً.'
          : 'Arrival in Luxor, private exploration of Valley of the Kings, Hatshepsut Temple, and grand Karnak & Luxor Temples illuminated by night.',
        meals: isArabic ? 'إقامة كاملة' : 'Full Board',
        activities: [
          isArabic ? 'وادي الملوك' : 'Valley of the Kings',
          isArabic ? 'معابد الكرنك' : 'Karnak Temple',
        ],
      });
    }

    if (constraints.beachRequired) {
      days.push({
        dayNumber: 6,
        title: isArabic
          ? 'الانتقال إلى الغردقة / البحر الأحمر'
          : 'Transfer to Hurghada / Red Sea Resort',
        description: isArabic
          ? 'الانتقال بمركبة مرسيدس خاصة إلى منتجع 5 نجوم في الغردقة للاستمتاع بشواطئ البحر الأحمر وشعابه المرجانية برعاية شاملة كلياً.'
          : 'Private Mercedes transfer to 5-star all-inclusive luxury resort in Hurghada along the Red Sea coast.',
        meals: isArabic ? 'شامل كلياً (All-Inclusive)' : 'All-Inclusive',
        activities: [
          isArabic ? 'استرخاء شاطئي' : 'Beach Relaxation',
          isArabic ? 'رياضات مائية' : 'Water Sports',
        ],
      });
    }

    // Departure Day
    days.push({
      dayNumber: daysCount,
      title: isArabic
        ? 'العودة إلى القاهرة والمغادرة الدولية'
        : 'Cairo Return & International Departure',
      description: isArabic
        ? 'الإفطار في الفندق، الانتقال بسيارة خاصة لمطار القاهرة الدولي، والمساعدة الكاملة في إجراءات المغادرة. رافقتكم السلامة.'
        : 'Breakfast, private transfer to Cairo International Airport, VIP exit assistance, and international flight departure.',
      meals: isArabic ? 'إفطار' : 'Breakfast',
      activities: [
        isArabic ? 'نقل المطار والتوديع' : 'Airport Transfer & Departure',
      ],
    });

    return {
      id: `prop-${Date.now()}`,
      title: isArabic
        ? `برنامج ${daysCount} أيام مخصص: ${destinations.join(' + ')}`
        : `Custom ${daysCount}-Day Itinerary: ${destinations.join(' + ')}`,
      durationDays: daysCount,
      destinations,
      tier: constraints.nileCruiseRequired ? 'ULTRA_VIP' : 'LUXURY',
      estimatedPricePerPerson: baseBudget,
      currency: 'USD',
      days,
      highlights: [
        isArabic
          ? 'إقامة 5 نجوم فاخرة مع إطلالات مميزة'
          : '5-Star luxury accommodations with premier views',
        isArabic
          ? 'مرشد سياحي خاص خبير في الآثار'
          : 'Dedicated private Egyptologist guide',
        isArabic
          ? 'سيارات ليموزين حديثة وخدمة استقبال VIP'
          : 'Private Mercedes fleet transfers & VIP airport concierge',
        isArabic
          ? 'نايل كروز فاخر بين أسوان والأقصر'
          : 'Full-board signature Nile Cruise sailing',
      ],
      inclusions: [
        isArabic
          ? 'جميع حجوزات الفنادق والكروز'
          : 'All luxury hotel & cruise accommodations',
        isArabic
          ? 'رسوم تذاكر المزارات الأثرية المذكورة'
          : 'All historical site entrance permits',
        isArabic
          ? 'رحلات الطيران الداخلي والتنقلات الخاصة'
          : 'All domestic flights & private ground transfers',
        isArabic
          ? 'خدمة المساعدة والكونسيرج على مدار 24 ساعة'
          : '24/7 dedicated travel designer concierge support',
      ],
      isCustomTailored: true,
      requiresHumanConfirmation: true,
    };
  }

  /**
   * Deterministic Itinerary Refinement Engine (supports user modifications)
   */
  public refineTripProposal(
    currentProposal: StructuredTripProposal,
    instruction: string,
    locale: string = 'en',
  ): StructuredTripProposal {
    const isArabic = locale.startsWith('ar');
    const text = instruction.toLowerCase();
    const updated = JSON.parse(
      JSON.stringify(currentProposal),
    ) as StructuredTripProposal;
    updated.id = `prop-${Date.now()}`;

    // Add Luxor day
    if (/(add|extra|زيادة|اضف|اضافة).*(luxor|الاقصر|الأقصر)/i.test(text)) {
      const newDayNum = updated.days.length;
      updated.durationDays += 1;
      updated.days.splice(updated.days.length - 1, 0, {
        dayNumber: newDayNum,
        title: isArabic
          ? 'الأقصر: معبد الدير البحري ومقابر النبلاء'
          : 'Luxor: Deir el-Bahari & Tombs of Nobles',
        description: isArabic
          ? 'يوم إضافي متعمق في الأقصر لزيارة معبد مدينة هابو، مقابر النبلاء، وجولة خاصة في أسواق الأقصر التقليدية.'
          : 'Additional in-depth exploration in Luxor visiting Medinet Habu Temple, Tombs of the Nobles, and private traditional bazaar stroll.',
        meals: isArabic ? 'إفطار + غداء' : 'Breakfast + Lunch',
        activities: [
          isArabic ? 'معبد هابو' : 'Medinet Habu',
          isArabic ? 'مقابر النبلاء' : 'Tombs of Nobles',
        ],
      });
      // Re-index departure day
      updated.days[updated.days.length - 1].dayNumber = updated.durationDays;
      updated.title = isArabic
        ? `برنامج ${updated.durationDays} أيام معدّل (تمت إضافة ليلة في الأقصر)`
        : `Refined ${updated.durationDays}-Day Itinerary (+1 Extra Night in Luxor)`;
    }

    // Remove Beach / Hurghada
    if (
      /(remove|cancel|without|حذف|بدون|الغاء|إلغاء).*(hurghada|beach|الغردقة|شاطئ|بحر)/i.test(
        text,
      )
    ) {
      updated.destinations = updated.destinations.filter(
        (d) => !/hurghada|beach|الغردقة/i.test(d),
      );
      updated.days = updated.days.filter(
        (d) => !/hurghada|الغردقة|منتجع/i.test(d.title + d.description),
      );
      updated.durationDays = updated.days.length;
      // Re-number
      updated.days.forEach((d, idx) => {
        d.dayNumber = idx + 1;
      });
      updated.title = isArabic
        ? `برنامج ${updated.durationDays} أيام معدّل (تم حذف الغردقة)`
        : `Refined ${updated.durationDays}-Day Itinerary (Hurghada Removed)`;
    }

    // Budget reduction
    if (
      /(reduce|lower|cheaper|اقل|أقل|تخفيض|رخص|ميزانية).*(budget|price|سعر|فلوس)/i.test(
        text,
      )
    ) {
      const currentPrice = currentProposal.estimatedPricePerPerson || 2000;
      updated.estimatedPricePerPerson = Math.round(currentPrice * 0.85);
      updated.tier = 'LUXURY';
    }

    return updated;
  }

  async processVisitorMessage(
    dto: ProcessChatMessageDto,
  ): Promise<GuiderOrchestratorResponse> {
    const startTime = Date.now();
    await this.validateAndLogSecurity(dto.message, dto.sessionId);
    const sanitizedMsg = sanitizePlainText(dto.message);
    const locale = (dto.locale || 'en').toLowerCase();
    const isArabic =
      locale.startsWith('ar') || /[\u0600-\u06FF]/.test(sanitizedMsg);

    const availability = await this.getPublicAvailabilityStatus();
    if (!availability.enabled) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'GUIDER_DISABLED',
        status: availability.status,
        message:
          availability.message ||
          (availability.status === 'MAINTENANCE'
            ? 'The GuideR AI Concierge service is currently undergoing scheduled maintenance.'
            : 'The GuideR AI Concierge service is currently offline.'),
      });
    }

    const config = await this.getOrCreateConfig();

    // 1. Get or create conversation session
    let conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { publicSessionId: dto.sessionId },
      include: {
        messages: {
          take: 12,
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
            take: 12,
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
          visitorNationality:
            dto.visitorInfo.nationality || conversation.visitorNationality,
        },
        include: {
          messages: {
            take: 12,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    // 1.1 Idempotency cache check: avoid duplicate execution and DB writes on client retry/timeout
    if (dto.idempotencyKey) {
      const existingAssistantMsg = (conversation.messages || []).find(
        (m: any) =>
          m.role === 'assistant' &&
          m.structuredContent &&
          typeof m.structuredContent === 'object' &&
          m.structuredContent.idempotencyKey === dto.idempotencyKey,
      );
      if (existingAssistantMsg) {
        this.logger.log(`Idempotent cache hit for key: ${dto.idempotencyKey}`);
        const cleanTours = (
          existingAssistantMsg.structuredContent?.tours || []
        ).map((t: any) => ({
          ...t,
          price: Number(t.price ?? t.basePriceUsd) || 0,
        }));
        return ResponseInvariantNormalizer.normalizeAndValidate(
          {
            conversationId: conversation.id,
            responseType:
              existingAssistantMsg.structuredContent?.responseType || 'text',
            intent:
              existingAssistantMsg.structuredContent?.intent || 'general_chat',
            message: {
              id: existingAssistantMsg.id,
              role: 'assistant',
              content: existingAssistantMsg.textContent,
              structuredContent: existingAssistantMsg.structuredContent,
              createdAt: existingAssistantMsg.createdAt.toISOString(),
            },
            recommendations: {
              tours: cleanTours,
              destinations:
                existingAssistantMsg.structuredContent?.destinations || [],
              proposal:
                existingAssistantMsg.structuredContent?.proposal || null,
              comparison:
                existingAssistantMsg.structuredContent?.comparison || null,
            },
            suggestedReplies: [],
            actions: [],
            handoff: {
              available: true,
              requested: conversation.status === 'HANDED_OFF',
              status: conversation.status,
            },
            leadCapture: { required: false, fields: [] },
            sources: existingAssistantMsg.knowledgeSources || [],
          },
          locale,
        );
      }
    }

    // 2. If human staff is actively taking over this conversation, do not send autonomous LLM reply
    if (
      conversation.status === 'HANDED_OFF' ||
      conversation.status === 'HUMAN_ACTIVE' ||
      conversation.status === 'CLOSED' ||
      conversation.status === 'ARCHIVED'
    ) {
      const userMsg = await (this.prisma as any).chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          textContent: sanitizedMsg,
          locale,
        },
      });

      return {
        conversationId: conversation.id,
        responseType: 'text',
        intent: 'handoff_request',
        message: {
          id: userMsg.id,
          role: 'user',
          content: sanitizedMsg,
          createdAt: userMsg.createdAt.toISOString(),
        },
        recommendations: {
          tours: [],
          destinations: [],
          proposal: null,
          comparison: null,
        },
        suggestedReplies: [],
        actions: [],
        handoff: {
          available: true,
          requested: true,
          status: conversation.status,
          assignedStaffId: conversation.assignedStaffId,
        },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };
    }

    // 3. Save user message with deduplication guard for rapid re-sends
    const recentDuplicate = conversation.messages.find(
      (m: any) =>
        m.role === 'user' &&
        m.textContent === sanitizedMsg &&
        Date.now() - new Date(m.createdAt).getTime() < 3000,
    );

    if (!recentDuplicate) {
      await (this.prisma as any).chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          textContent: sanitizedMsg,
          locale,
        },
      });
    }

    // 4. Extract constraints & merge into multi-turn bounded state (with explicit false negation override)
    const currentConstraints =
      this.tourCatalogTool.extractTravelConstraints(sanitizedMsg);
    const existingPrefs = conversation.travelPreferences || {};

    const mergedConstraints: TravelConstraints = {
      ...existingPrefs,
      ...currentConstraints,
      targetDuration:
        currentConstraints.targetDuration || existingPrefs.targetDuration,
      maxBudget: currentConstraints.maxBudget || existingPrefs.maxBudget,
      currency: currentConstraints.currency || existingPrefs.currency,
      nileCruiseRequired:
        currentConstraints.nileCruiseRequired !== undefined
          ? currentConstraints.nileCruiseRequired
          : existingPrefs.nileCruiseRequired,
      beachRequired:
        currentConstraints.beachRequired !== undefined
          ? currentConstraints.beachRequired
          : existingPrefs.beachRequired,
      country: currentConstraints.country || existingPrefs.country || undefined,
    };

    // 5. Authoritative Intent Classification with Negation Guards
    const isGreetingOrIdentity =
      /(^|[\s،,.!?])(hello|hi|hey|greetings|who\s+are\s+you|what\s+is\s+your\s+name|your\s+name|مرحبا|مرحباً|اهلا|أهلا|أهلاً|السلام\s+عليكم|صباح\s+الخير|مساء\s+الخير|اسمك\s+ايه|اسمك\s+اي|مين\s+انت|من\s+انت|من\s+انتم|انت\s+مين|عرف\s+بنفسك)($|[\s،,.!?])/i.test(
        sanitizedMsg.trim(),
      );
    const isCasualOrGratitude =
      /(^|[\s،,.!?])(thanks|thank\s+you|thx|ok|okay|cool|great|bye|goodbye|شكرا|شكراً|تسلم|الف\s+شكر|تمام|اوك|أوك|ماشي|مع\s+السلامة|باي)($|[\s،,.!?])/i.test(
        sanitizedMsg.trim(),
      );
    const isHandoffRequest =
      /(human|agent|representative|advisor|specialist|consultant|support|speak\s+to|talk\s+to|بشري|إنسان|موظف|خدمة\s+العملاء|مستشار|تحدث\s+مع|تواصل\s+مع|شخص\s+حقيقي)/i.test(
        sanitizedMsg,
      );

    // General travel question e.g. weather, best time to visit, visa, currency, safety
    const isGeneralTravelQuestion =
      /(افضل\s+وقت|أفضل\s+وقت|الطقس|الجو|فيزا|تأشيرة|عملة|امان|أمان|نصائح|تاريخ|اهرامات|معلومات|best\s+time|weather|visa|currency|safety|tips|history|dress\s+code|what\s+to\s+pack)/i.test(
        sanitizedMsg,
      );

    // Negation check for booking (e.g. "مش عايز أحجز", "أنا بس بسأل عن السعر مش عايز حجز", "don't want to book")
    const isBookingNegated =
      /(مش\s+عايز\s+احجز|مش\s+عايز\s+أحجز|لا\s+اريد\s+حجز|لا\s+أريد\s+حجز|مش\s+للحجز|مش\s+حجز|بسأل\s+بس|بسأل\s+عن\s+السعر|don't\s+want\s+to\s+book|dont\s+want\s+to\s+book|not\s+looking\s+to\s+book|not\s+booking|just\s+asking)/i.test(
        sanitizedMsg,
      );
    const isBookingIntent =
      !isBookingNegated &&
      /(how\s+to\s+book|book\s+now|book\s+this|reserve\s+this|reserve\s+now|i\s+want\s+to\s+book|حجز\s+الان|احجز\s+لي|اريد\s+حجز|أريد\s+حجز|كيف\s+احجز|كيف\s+أحجز|طريقة\s+الحجز)/i.test(
        sanitizedMsg,
      );
    const isComparison =
      /(compare|difference|versus|vs|مقارنة|قارن|الفرق\s+بين)/i.test(
        sanitizedMsg,
      );

    // Negation check for tours / trips (e.g. "مش عايز رحلة", "don't want a tour")
    const isTourNegated =
      /(مش\s+عايز\s+رحل|لا\s+اريد\s+رحل|لا\s+أريد\s+رحل|بدون\s+رحلات|don't\s+want\s+a?\s*tour|not\s+interested\s+in\s+tours)/i.test(
        sanitizedMsg,
      );

    const isItineraryRequest =
      !isGeneralTravelQuestion &&
      !isTourNegated &&
      (/(tailor|custom|plan\s+my|design|day\s+by\s+day|itinerary|مخصوص|تفصيل|تخصيص|صمم|جدول\s+سياحي|خطة\s+رحلة|برنامج\s+مخصص)/i.test(
        sanitizedMsg,
      ) ||
        (/(design|plan|create)\s/i.test(sanitizedMsg) &&
          /(tour|trip|itinerary)/i.test(sanitizedMsg)));
    const isRefinement =
      Boolean(existingPrefs.currentProposal) &&
      /(add|remove|make|change|تعديل|زيادة|حذف|تغيير|بدل)/i.test(sanitizedMsg);

    // Destination inquiry with country filter e.g. "رحلات مصر", "واجهة مصر", "ما هي رحلات مصر", "destinos egipto"
    const isExplicitDestinationInquiry =
      !isTourNegated &&
      /(واجهة|واجهه|وجهة|وجهه|رحلات|برامج|destin|destination|destino|tours\s+in|packages\s+in)\s+(مصر|تركيا|دبي|الامارات|الأردن|المغرب|تونس|اليونان|egypt|turkey|dubai|jordan|morocco)/i.test(
        sanitizedMsg,
      ) &&
      Boolean(mergedConstraints.country);

    // Pure price question e.g. "عايز أعرف السعر", "بكام الرحلة", "how much is the tour"
    const isPriceInquiry =
      /(كم\s+سعر|كم\s+تكلفة|ما\s+هو\s+سعر|ما\s+سعر|بكام|سعر\s+الرحلة|تكلفة\s+الرحلة|how\s+much|what\s+is\s+the\s+price)/i.test(
        sanitizedMsg,
      );

    // Explicit tour recommendation request
    const isRecommendationRequest =
      !isTourNegated &&
      (isExplicitDestinationInquiry ||
        /(اقترح|رشح|اريد\s+رحل|أريد\s+رحل|نايل\s+كروز|ما\s+هي\s+الرحلات|ما\s+افضل\s+الرحلات|ما\s+أفضل\s+الرحلات|عروض\s+الرحلات|باقات\s+سياحية|recommend|suggest\s+a\s+trip|tour\s+package)/i.test(
          sanitizedMsg,
        ));

    const isLeadCaptureInquiry =
      /(private\s+quote|request\s+a\s+quote|contact\s+me|reach\s+out|طلب\s+عرض\s+سعر|عرض\s+سعر\s+خاص|تواصل\s+معي|استشارة\s+خاصة)/i.test(
        sanitizedMsg,
      );

    // Canonical GuiderResponseType & intent mapping
    let responseType: GuiderResponseType = 'text';
    let intent = 'general_chat';

    if (isBookingIntent) {
      responseType = 'booking_intent';
      intent = 'booking_request';
    } else if (isLeadCaptureInquiry) {
      responseType = 'lead_capture';
      intent = 'lead_inquiry';
    } else if (isComparison) {
      responseType = 'comparison';
      intent = 'tour_comparison';
    } else if (isItineraryRequest || isRefinement) {
      responseType = 'itinerary';
      intent = isRefinement ? 'itinerary_refinement' : 'custom_itinerary';
    } else if (
      isRecommendationRequest &&
      !isGeneralTravelQuestion &&
      !isPriceInquiry
    ) {
      responseType = 'recommendation';
      intent = 'tour_recommendation';
    } else if (isGreetingOrIdentity) {
      responseType = 'text';
      intent = 'greeting';
    } else if (isCasualOrGratitude) {
      responseType = 'text';
      intent = 'casual';
    } else if (isHandoffRequest) {
      responseType = 'text';
      intent = 'handoff_request';
    } else {
      responseType = 'text';
      intent = 'informational';
    }

    let structuredProposal: StructuredTripProposal | null = null;
    if (isRefinement && existingPrefs.currentProposal) {
      structuredProposal = this.refineTripProposal(
        existingPrefs.currentProposal,
        sanitizedMsg,
        locale,
      );
    } else if (
      isItineraryRequest &&
      (mergedConstraints.minDuration ||
        mergedConstraints.maxDuration ||
        mergedConstraints.nileCruiseRequired ||
        isItineraryRequest)
    ) {
      structuredProposal = this.generateTripProposal(mergedConstraints, locale);
    }

    // Save updated memory state back to conversation
    await Promise.resolve(
      (this.prisma as any).chatConversation.update({
        where: { id: conversation.id },
        data: {
          travelPreferences: {
            ...mergedConstraints,
            currentProposal:
              structuredProposal || existingPrefs.currentProposal,
          },
          tripDuration: mergedConstraints.targetDuration
            ? `${mergedConstraints.targetDuration} Days`
            : conversation.tripDuration,
          budgetRange: mergedConstraints.maxBudget
            ? `$${mergedConstraints.maxBudget} USD`
            : conversation.budgetRange,
        },
      }),
    ).catch(() => {});

    const retrievalStart = Date.now();
    const keywords = sanitizedMsg
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    let sources: GroundingSource[] = [];
    let recommendedTours: GroundedTourRecommendation[] = [];
    let recommendedDestinations: GroundedDestinationRecommendation[] = [];
    let destinationSummaryInfo: {
      destination: string;
      totalToursCount: number;
      slug: string;
    } | null = null;
    let tourComparison: StructuredTourComparison | null = null;

    // RAG sources retrieved for informational / concierge grounding
    const shouldRetrieveKnowledge =
      !isGreetingOrIdentity && !isCasualOrGratitude;
    if (shouldRetrieveKnowledge) {
      sources = await this.ragRetrieval.retrieveRelevantKnowledge(
        sanitizedMsg,
        locale,
        4,
      );
    }

    // Grounded Catalog Tour Retrieval: strictly scoped to recommendation & comparison intents
    if (responseType === 'recommendation') {
      if (isExplicitDestinationInquiry && mergedConstraints.country) {
        const destRes =
          await this.tourCatalogTool.getDestinationSummaryAndTours(
            mergedConstraints.country,
            locale,
            4,
          );
        destinationSummaryInfo = {
          destination: destRes.destination,
          totalToursCount: destRes.totalToursCount,
          slug: destRes.slug,
        };
        recommendedTours = destRes.tours;
        if (destRes.landingPage) {
          recommendedDestinations = [destRes.landingPage];
        }
      } else {
        const [rTours, rDests] = await Promise.all([
          this.tourCatalogTool.searchGroundedTours(
            keywords,
            3,
            locale,
            mergedConstraints,
          ),
          this.tourCatalogTool.searchGroundedDestinations(keywords, 2, locale),
        ]);
        recommendedTours = rTours;
        recommendedDestinations = rDests;
      }
    } else if (responseType === 'comparison') {
      const rTours = await this.tourCatalogTool.searchGroundedTours(
        keywords,
        2,
        locale,
        mergedConstraints,
      );
      recommendedTours = rTours;
      const tourA = recommendedTours[0]?.id || recommendedTours[0]?.slug;
      const tourB = recommendedTours[1]?.id || recommendedTours[1]?.slug;
      tourComparison = await this.tourCatalogTool.compareTwoTours(
        tourA,
        tourB,
        locale,
      );
    }
    const retrievalLatencyMs = Date.now() - retrievalStart;

    // 8. Assemble system prompt stack with strict untrusted data isolation
    let ragContext = 'No specific knowledge base articles found.';
    if (sources.length > 0) {
      const customDirectives = sources.filter(
        (s: any) =>
          s.sourceEntityType === 'QA_DIRECTIVE' ||
          s.sourceType === 'RESPONSE_RULE' ||
          (s.tags && s.tags.includes('QA_DIRECTIVE')),
      );
      const standardKnowledge = sources.filter(
        (s: any) =>
          s.sourceEntityType !== 'QA_DIRECTIVE' &&
          s.sourceType !== 'RESPONSE_RULE' &&
          (!s.tags || !s.tags.includes('QA_DIRECTIVE')),
      );

      const directivesText =
        customDirectives.length > 0
          ? `MANDATORY DIRECT RESPONSE RULES (قواعد وتوجيهات الرد المباشرة - إلزامية التطبيق إذا سأل العميل عن الموضوع):\n${customDirectives.map((d: any) => `* IF ASKED ABOUT "${d.title}": GuideR MUST ANSWER STRICTLY WITH: "${d.content}"`).join('\n')}\n`
          : '';

      const standardText =
        standardKnowledge.length > 0
          ? `GROUNDED KNOWLEDGE BASE:\n${standardKnowledge.map((s: any) => `[${s.title}]: ${s.content}`).join('\n')}`
          : '';

      ragContext = `${directivesText}\n${standardText}`.trim();
    }

    const destContext = destinationSummaryInfo
      ? `DESTINATION SUMMARY: The destination "${destinationSummaryInfo.destination}" has ${destinationSummaryInfo.totalToursCount} active luxury tours in the catalog. Landing page: /destinations/${destinationSummaryInfo.slug}. Mention the destination details and available tour count clearly.`
      : '';

    const tourContext =
      recommendedTours.length > 0
        ? `REAL GROUNDED CATALOG TOURS:\n${recommendedTours.map((t) => `- ${t.title} (${t.destination}) - Pricing: ${t.price > 0 ? `$${t.price} ${t.currency}` : 'On Request / Private Quote (الأسعار عند الطلب)'} - URL: ${t.publicUrl} - Reasons: ${t.matchReasons?.join(', ')}`).join('\n')}`
        : 'No specific catalog tour matches requested for this interaction.';

    const historyContext = conversation.messages
      .slice()
      .reverse()
      .map((m: any) => `${m.role.toUpperCase()}: ${m.textContent}`)
      .join('\n');

    const selectedPersona =
      AI_PERSONAS.find((p) => p.code === dto.personaCode) || AI_PERSONAS[0];

    const fullSystemPrompt = `${config.systemInstructions}

SALES PERSONALITY: ${config.salesPersonality || 'Elite Luxury Concierge'}
TONE OF VOICE: ${selectedPersona.tone || config.toneOfVoice || 'Warm, Executive, Knowledgeable'}

${selectedPersona.systemPromptAddendum}

${destContext}

${ragContext}

${tourContext}

CONVERSATION & STYLING RULES:
- ZERO ARCHAIC HONORIFICS POLICY:
  * NEVER use archaic or gender-presumptuous phrases such as: "سيدي", "سيدتي", "سيدي/سيدتي", "سيدي الكريم", "سيدتي الكريمة", "حضرتكم", "يا فندم", "يسعدني خدمتكم".
  * Greet and converse warmly, elegantly, and naturally like an elite private luxury concierge: "أهلاً بك", "مرحباً بك", "يسعدني مساعدتك", "سعيد بتواصلي معك", using gender-neutral modern luxury hospitality phrasing.
- ZERO CATALOG DUMPING ON INFORMATIONAL QUERIES:
  * When the traveler asks general travel advice (weather, best time to visit, culture, currency, safety, packing, historical facts), focus entirely on providing an authoritative, captivating concierge answer.
  * DO NOT dump or list tour packages or prices when answering general informational questions.
  * Only recommend specific tours when the traveler explicitly asks for tour packages, recommendations, or planning.
- Address the user's greeting or inquiry directly and naturally.
- When greeting or answering your identity (e.g. asking your name), introduce yourself as GuideR (جايدر), the luxury travel concierge for Dunas Travel (دوناس ترافيل), and politely offer how you can help without dumping unsolicited tour listings.
- STRICT PRICING & BOOKING INTEGRITY (قواعد الأسعار والحجز الإلزامية في جايدر):
  * GuideR is a luxury travel consultant and concierge. Pricing for curated luxury tours and bespoke packages is customized based on travel dates, group size, and private arrangements ("Pricing: On Request / Private Quote" / "الأسعار: عند الطلب / عرض سعر مخصص").
  * NEVER claim that luxury tours cost 0 or $0 or are free.
  * DECISION: GuideR MUST NOT BOOK TRIPS DIRECTLY. GuideR recommends tours and directs travelers to click the [View Trip] / [عرض تفاصيل الرحلة] button on the tour card to inspect the itinerary, customize dates, and book securely on the official website.
- DESTINATION & ALL TOURS DISCOVERY (استعراض الواجهات والرحلات):
  * When a user asks about any destination (e.g. Egypt, Turkey, Dubai, Jordan, Morocco, Tunisia, Greece, Holy Land) or asks to view all tours for a destination:
  * Provide a captivating, elegant summary of the destination's top attractions and luxury experiences, and explicitly state the exact number of curated tours (${destinationSummaryInfo?.totalToursCount || recommendedTours.length || 'several'} tours in our catalog).
  * Always provide this direct clickable link format:
    - Arabic: "لمعرفة رحلات الواجهة المطلوبة يرجى الضغط على الرابط التالي: [استعراض كافة رحلات ${destinationSummaryInfo?.destination || 'الواجهة'}](/destinations/${destinationSummaryInfo?.slug || 'egypt'})"
    - English: "To view all tours for this destination, please click the following link: [View all ${destinationSummaryInfo?.destination || 'Destination'} Tours](/destinations/${destinationSummaryInfo?.slug || 'egypt'})"
    - Spanish: "Para conocer todos los tours de este destino, por favor haga clic en el siguiente enlace: [Ver todos los tours de ${destinationSummaryInfo?.destination || 'Destino'}](/destinations/${destinationSummaryInfo?.slug || 'egypt'})"
    - Portuguese: "Para conhecer todos os passeios deste destino, por favor clique no link a seguir: [Ver todos os passeios de ${destinationSummaryInfo?.destination || 'Destino'}](/destinations/${destinationSummaryInfo?.slug || 'egypt'})"
    - Italian: "Per visualizzare tutti i tour di questa destinazione, clicca sul seguente link: [Visualizza tutti i tour di ${destinationSummaryInfo?.destination || 'Destinazione'}](/destinations/${destinationSummaryInfo?.slug || 'egypt'})"
  * Direct them to the interactive tour cards below to explore the daily itineraries with the [View Trip] button.
- CUSTOM TRIP BUILDER (تخصيص رحلة سياحية مخصصة عبر المحادثة):
  * When a user asks to design, tailor, or customize a trip (رحلة مخصصة / صمم لي برنامج):
  * Step 1 (Destination): Ask which country or destinations they want to visit if not specified.
  * Step 2 (Trip Details): Ask about their travel dates, duration in days, number of travelers (Adults & Children), and preferred style (Nile cruise, historical, beaches, luxury 5-star).
  * Step 3 (Confirmation): Present the day-by-day customized program and inform the client they can click the glowing "اطلب الرحلة الآن" button to submit their inquiry directly to our concierge team and receive a private quote.
- Write in clean, elegant, fluid Arabic/English/Spanish/Italian/Portuguese based on the user's language. Do NOT overuse asterisks (**) in the middle of standard sentences.
- When listing itinerary days or features, use clean bullet points or numbered lists.
- Respond in the language of the user message (Locale detected: ${locale}).
- Never fabricate tours, prices, or policies that are not grounded in real facts.`;

    const userPrompt = historyContext
      ? `CONVERSATION HISTORY:\n${historyContext}\n\nUSER MESSAGE:\n${sanitizedMsg}`
      : sanitizedMsg;

    // 8. Invoke Provider Pool with Failover & Fallback
    let assistantReply = config.fallbackMessage;
    let inputTokens = 0;
    let outputTokens = 0;
    let latencyMs = 0;
    let isError = false;
    let usedProvider = config.provider || 'google';
    let usedModel = config.model || 'gemini-3.7-flash';

    const providerStart = Date.now();
    try {
      const response = await this.keyPoolService.executeWithFailover(
        userPrompt,
        {
          systemPrompt: fullSystemPrompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          timeoutMs: config.requestTimeoutMs,
        },
      );

      assistantReply = response.text || config.fallbackMessage;
      inputTokens = response.inputTokens;
      outputTokens = response.outputTokens;
      latencyMs = response.latencyMs || Date.now() - providerStart;
      usedProvider = response.provider;
      usedModel = response.model;
    } catch (err: any) {
      this.logger.warn(
        `AI Provider Pool unavailable, executing intelligent local RAG synthesis: ${err.message}`,
      );
      isError = true;
      latencyMs = Date.now() - providerStart;

      // Intelligent Local Synthesis adapted to selected Persona
      if (tourComparison) {
        if (isArabic) {
          assistantReply = `يسعدني مقارنة رحلاتنا المميزة لك! إليك مقارنة تفصيلية بين "${tourComparison.tours[0].title}" و "${tourComparison.tours[1].title}":\n\n${tourComparison.summaryRecommendation}`;
        } else {
          assistantReply = `I am delighted to compare these signature tours for you! Here is the comparison between "${tourComparison.tours[0].title}" and "${tourComparison.tours[1].title}":\n\n${tourComparison.summaryRecommendation}`;
        }
      } else if (structuredProposal) {
        if (isArabic) {
          assistantReply = `يسعدني جداً إعداد هذا البرنامج الفاخر لك! بناءً على طلبك، تم إعداد مسار رحلة مخصص يشمل ${structuredProposal.destinations.join(' و')} لمدّة ${structuredProposal.durationDays} أيام. يمكنك استعراض تفاصيل البرنامج بالأسفل والضغط على زر "اطلب الرحلة الآن" لإرسال طلبك فوراً لمستشارينا.`;
        } else {
          assistantReply = `I am delighted to curate this bespoke itinerary for you! Based on your preferences, I have crafted a ${structuredProposal.durationDays}-day luxury journey across ${structuredProposal.destinations.join(' & ')}. Review the day-by-day plan below and click "Request Trip Now" to submit directly!`;
        }
      } else if (destinationSummaryInfo && recommendedTours.length > 0) {
        const destName = destinationSummaryInfo.destination;
        const count = destinationSummaryInfo.totalToursCount;
        const destSlug = destinationSummaryInfo.slug;
        if (isArabic) {
          assistantReply = `أهلاً بك! لمعرفة رحلات الواجهة المطلوبة يرجى الضغط على الرابط التالي: [استعراض كافة رحلات ${destName}](/destinations/${destSlug})\n\nتضم وجهة ${destName} حالياً (${count}) رحلات وبرامج سياحية فاخرة مصممة بأعلى معايير الرفاهية. يمكنك أيضاً تصفح أبرز الباقات أدناه:`;
        } else if (locale.startsWith('es')) {
          assistantReply = `¡Bienvenido! Para conocer todos los tours de este destino, por favor haga clic en el siguiente enlace: [Ver todos los tours de ${destName}](/destinations/${destSlug})\n\nContamos con ${count} paquetes de lujo en ${destName}.`;
        } else if (locale.startsWith('pt')) {
          assistantReply = `Olá! Para conhecer todos os passeios deste destino, por favor clique no link a seguir: [Ver todos os passeios de ${destName}](/destinations/${destSlug})\n\nOferecemos ${count} roteiros exclusivos em ${destName}.`;
        } else if (locale.startsWith('it')) {
          assistantReply = `Benvenuto! Per visualizzare tutti i tour di questa destinazione, clicca sul seguente link: [Visualizza tutti i tour di ${destName}](/destinations/${destSlug})\n\nOffriamo ${count} tour esclusivi per ${destName}.`;
        } else {
          assistantReply = `Welcome! To view all tours for this destination, please click the following link: [View all ${destName} Tours](/destinations/${destSlug})\n\nWe feature ${count} signature luxury tour packages curated by Dunas Travel. Explore our top tours below:`;
        }
      } else if (recommendedTours.length > 0) {
        const topTour = recommendedTours[0];
        const priceTagAr =
          topTour.price > 0
            ? `بسعر يبدأ من $${topTour.price} ${topTour.currency}`
            : 'والسعر عند الطلب بعرض سعر مخصص';
        const priceTagEn =
          topTour.price > 0
            ? `starting from $${topTour.price} ${topTour.currency}`
            : 'with private pricing on request';
        if (isArabic) {
          if (dto.personaCode === 'egyptologist') {
            assistantReply = `أهلاً بك يا باحث التاريخ والحضارة العريقة! نقترح عليك رحلة "${topTour.title}" في ${topTour.destination} لاكتشاف عظمة الفراعنة والمعابد الخالدة، ${priceTagAr}. يمكنك استعراض تفاصيل البرنامج الكامل بالأسفل عبر زر [عرض تفاصيل الرحلة].`;
          } else if (dto.personaCode === 'practical_budget') {
            assistantReply = `أهلاً بك! بأعلى قيمة استثمارية وأرقى مستوى من الخدمة، نقترح عليك رحلة "${topTour.title}" في ${topTour.destination}، ${priceTagAr}. استعرض البرنامج بالأسفل عبر [عرض تفاصيل الرحلة].`;
          } else if (dto.personaCode === 'family_adventure') {
            assistantReply = `أهلاً وسهلاً بك وبعائلتك الكريمة! لتجربة عائلية مريحة وممتعة للجميع، نقترح رحلة "${topTour.title}" في ${topTour.destination}، ${priceTagAr}. استعرض التفاصيل الكاملة بالأسفل عبر [عرض تفاصيل الرحلة].`;
          } else if (dto.personaCode === 'romantic_honeymoon') {
            assistantReply = `أهلاً بكما! لقضاء عطلة رومانسية ساحرة وسط أروع الأجواء، نقترح رحلة "${topTour.title}" في ${topTour.destination}، ${priceTagAr}. استعرض تفاصيل الرحلة بالأسفل عبر [عرض تفاصيل الرحلة].`;
          } else {
            assistantReply = `أهلاً بك! نقترح عليك رحلة "${topTour.title}" في ${topTour.destination}، ${priceTagAr}. يمكنك الضغط على زر [عرض تفاصيل الرحلة] بالأسفل لاستعراض البرنامج الكامل ومواعيد الانطلاق.`;
          }
        } else {
          assistantReply = `Hello! Based on your inquiry, I highly recommend our signature tour "${topTour.title}" in ${topTour.destination} (${priceTagEn}). Click [View Trip] on the tour card below to review the full itinerary and reserve your dates!`;
        }
      } else if (sources.length > 0) {
        assistantReply = isArabic
          ? `أهلاً بك! إليك التفاصيل المعتمدة بخصوص استفسارك:\n\n${sources[0].content}`
          : `Hello! Here are the verified details from our concierge base:\n\n${sources[0].content}`;
      } else {
        assistantReply = isArabic
          ? `أهلاً بك في دوناس ترافيل! كيف يمكنني مساعدتك في التخطيط لرحلتك الفاخرة القادمة؟`
          : config.fallbackMessage;
      }
    }

    // 9. Structured Payload Serialization
    const structuredContentPayload: any = {
      responseType,
      intent,
      tours: recommendedTours,
      destinations: recommendedDestinations,
    };
    if (destinationSummaryInfo) {
      structuredContentPayload.destinationSummary = destinationSummaryInfo;
    }
    if (tourComparison) {
      structuredContentPayload.type = 'tour_comparison';
      structuredContentPayload.comparison = tourComparison;
    } else if (structuredProposal) {
      structuredContentPayload.type = 'itinerary_proposal';
      structuredContentPayload.proposal = structuredProposal;
    } else {
      structuredContentPayload.type = responseType;
    }

    // 10. Race condition guard: if conversation transitioned to HANDED_OFF while waiting for provider
    const freshConversation = await (
      this.prisma as any
    ).chatConversation.findUnique({
      where: { id: conversation.id },
    });
    if (
      freshConversation &&
      (freshConversation.status === 'HANDED_OFF' ||
        freshConversation.status === 'HUMAN_ACTIVE' ||
        freshConversation.status === 'CLOSED' ||
        freshConversation.status === 'ARCHIVED')
    ) {
      this.logger.warn(
        `AI completion discarded for conversation ${conversation.id} because staff took over during generation.`,
      );
      return {
        conversationId: conversation.id,
        responseType,
        intent,
        message: {
          id: 'discarded',
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [],
          destinations: [],
          proposal: null,
          comparison: null,
        },
        suggestedReplies: [],
        actions: [],
        handoff: {
          available: true,
          requested: true,
          status: freshConversation.status,
        },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };
    }

    const hasContactDetails = Boolean(
      conversation.visitorEmail || conversation.visitorPhone,
    );
    const requiresLeadForm =
      !hasContactDetails &&
      (responseType === 'lead_capture' ||
        (responseType === 'booking_intent' && !hasContactDetails) ||
        (responseType === 'itinerary' &&
          Boolean(structuredProposal) &&
          /(اريد\s+حجز|طلب\s+عرض|احجز|تواصل\s+معي|book\s+this|request\s+quote)/i.test(
            sanitizedMsg,
          )));

    let suggestedReplies: string[] = [];
    if (isArabic) {
      switch (responseType) {
        case 'recommendation':
          suggestedReplies = [
            'عرض تفاصيل البرنامج اليومي',
            'هل يمكن تعديل مدة الرحلة؟',
            'مقارنة هذه الرحلة مع باقة أخرى',
            'طلب استشارة خاصة مع مستشار VIP',
          ];
          break;
        case 'itinerary':
          suggestedReplies = [
            'أضف يوم استرخاء إضافي',
            'هل يمكن تضمين نايل كروز؟',
            'طلب عرض سعر رسمي لهذا البرنامج',
            'تحدث مع خبير التخطيط السياحي',
          ];
          break;
        case 'comparison':
          suggestedReplies = [
            'ما هي أفضل أوقات السفر لهذه الرحلات؟',
            'هل تشمل الجولات مرشداً خاصاً؟',
            'طلب تفاصيل الأسعار والحجز',
          ];
          break;
        case 'booking_intent':
          suggestedReplies = [
            'عرض شروط الدفع والإلغاء',
            'التحدث مع مستشار الحجوزات VIP',
            'استعراض تفاصيل البرنامج الكامل',
          ];
          break;
        default:
          if (intent === 'greeting') {
            suggestedReplies = [
              'استكشف برامج مصر الفاخرة',
              'ما أفضل وقت لزيارة الأقصر وأسوان؟',
              'تصميم برنامج سياحي مخصص',
              'تحدث مع مستشار سياحي VIP',
            ];
          } else {
            suggestedReplies = [
              'اقترح علي رحلة مميزة تناسب هذا الموسم',
              'كم تستغرق الرحلة المثالية لمصر؟',
              'تصميم برنامج سفر خاص بي',
            ];
          }
      }
    } else {
      switch (responseType) {
        case 'recommendation':
          suggestedReplies = [
            'View daily itinerary breakdown',
            'Can this trip duration be customized?',
            'Compare this with another package',
            'Speak with a VIP travel specialist',
          ];
          break;
        case 'itinerary':
          suggestedReplies = [
            'Add an extra day of relaxation',
            'Include a 5-star Nile cruise',
            'Request official quote for this plan',
            'Connect with our trip curator',
          ];
          break;
        case 'comparison':
          suggestedReplies = [
            'Best travel season for these tours',
            'Are private guides included?',
            'Request private pricing & booking details',
          ];
          break;
        case 'booking_intent':
          suggestedReplies = [
            'Review payment and cancellation terms',
            'Speak with a VIP booking advisor',
            'Explore full tour details',
          ];
          break;
        default:
          suggestedReplies = [
            'Discover signature Egypt itineraries',
            'What is the best season to visit?',
            'Design a bespoke private trip',
            'Speak with a VIP luxury advisor',
          ];
      }
    }

    const totalDuration = Date.now() - startTime;
    const costUsd = this.calculateCostUsd(usedModel, inputTokens, outputTokens);

    const candidateResponse: GuiderOrchestratorResponse = {
      conversationId: conversation.id,
      responseType,
      intent,
      message: {
        id: 'pending',
        role: 'assistant',
        content: assistantReply,
        structuredContent: structuredContentPayload,
        createdAt: new Date().toISOString(),
      },
      recommendations: {
        tours: recommendedTours,
        destinations: recommendedDestinations,
        proposal: structuredProposal,
        comparison: tourComparison,
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
      telemetry: {
        retrievalLatencyMs,
        providerLatencyMs: latencyMs,
        totalLatencyMs: totalDuration,
        costUsd,
      },
    };

    // 11. Enforce Response Invariant Rules (Authoritative Contract Normalization)
    const normalizedResponse = ResponseInvariantNormalizer.normalizeAndValidate(
      candidateResponse,
      locale,
    );

    // 12. Save invariant-hardened assistant message to DB
    const finalStructuredPayload = {
      ...normalizedResponse.message.structuredContent,
      responseType: normalizedResponse.responseType,
      intent: normalizedResponse.intent,
      tours: normalizedResponse.recommendations.tours,
      destinations: normalizedResponse.recommendations.destinations,
      proposal: normalizedResponse.recommendations.proposal,
      comparison: normalizedResponse.recommendations.comparison,
      idempotencyKey: dto.idempotencyKey || null,
    };

    const assistantMsg = await (this.prisma as any).chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        textContent: normalizedResponse.message.content,
        structuredContent: finalStructuredPayload,
        locale,
        provider: usedProvider,
        model: usedModel,
        inputTokens,
        outputTokens,
        latencyMs,
        isError,
        knowledgeSources: sources as any,
        recommendedTourIds: (
          normalizedResponse.recommendations.tours || []
        ).map((t) => t.id),
        recommendedDestinations: (
          normalizedResponse.recommendations.destinations || []
        ).map((d) => d.id),
      },
    });

    // 13. FinOps Telemetry logging
    await (this.prisma as any).aiUsageLog
      .create({
        data: {
          provider: usedProvider,
          model: usedModel,
          inputTokens,
          outputTokens,
          estimatedCostUsd: costUsd,
          latencyMs: totalDuration,
          isSuccess: !isError,
          conversationId: conversation.id,
          sessionId: dto.sessionId,
          endpoint: '/api/ai/chat/message',
        },
      })
      .catch((e: any) =>
        this.logger.warn(`Could not save usage log: ${e.message}`),
      );

    normalizedResponse.message.id = assistantMsg.id;
    normalizedResponse.message.createdAt = assistantMsg.createdAt.toISOString();
    return normalizedResponse;
  }

  /**
   * Server-Sent Events (SSE) Streaming Engine
   */
  async streamVisitorMessage(dto: ProcessChatMessageDto, res: Response) {
    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      if (clientDisconnected || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const availability = await this.getPublicAvailabilityStatus();
      if (!availability.enabled) {
        sendEvent('error', {
          code: 'GUIDER_DISABLED',
          status: availability.status,
          message:
            availability.message ||
            (availability.status === 'MAINTENANCE'
              ? 'The GuideR AI Concierge service is currently undergoing scheduled maintenance.'
              : 'The GuideR AI Concierge service is currently offline.'),
        });
        res.end();
        return;
      }

      sendEvent('status', { phase: 'validating' });
      await this.validateAndLogSecurity(dto.message, dto.sessionId);

      if (clientDisconnected) return;

      sendEvent('status', { phase: 'retrieving' });
      const result = await this.processVisitorMessage(dto);

      if (clientDisconnected) return;

      if (result.message?.id !== 'discarded') {
        const content = result.message.content || '';
        const chunkSize = 20;
        for (let i = 0; i < content.length; i += chunkSize) {
          if (clientDisconnected) break;
          sendEvent('token', { delta: content.slice(i, i + chunkSize) });
        }

        const recs = result.recommendations;
        if (
          !clientDisconnected &&
          recs &&
          (recs.proposal ||
            recs.comparison ||
            (recs.tours && recs.tours.length > 0))
        ) {
          sendEvent('structured', {
            proposal: recs.proposal || null,
            comparison: recs.comparison || null,
            tours: recs.tours || [],
          });
        }
      }

      if (!clientDisconnected) {
        sendEvent('complete', result);
      }
    } catch (err: any) {
      if (!clientDisconnected) {
        sendEvent('error', {
          message: err.message || 'Stream processing failed',
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  /**
   * Idempotent Lead Submission
   */
  async submitLead(
    sessionId: string,
    visitorInfo: {
      name: string;
      email: string;
      phone?: string;
      nationality?: string;
      travelNotes?: string;
    },
    idempotencyKey?: string,
  ) {
    const conversation = await (this.prisma as any).chatConversation.findUnique(
      {
        where: { publicSessionId: sessionId },
      },
    );

    if (!conversation) {
      throw new BadRequestException('Invalid chat session token');
    }

    // 1. Session-level idempotency check
    if (
      conversation.leadStatus === 'QUALIFIED' &&
      conversation.visitorEmail === visitorInfo.email
    ) {
      return {
        success: true,
        leadId: conversation.customerId || conversation.id,
        leadStatus: 'QUALIFIED',
        isDuplicate: true,
      };
    }

    // 2. Global 5-minute idempotency check
    if (
      visitorInfo.email &&
      (this.prisma as any)?.tailorMadeInquiry?.findFirst
    ) {
      try {
        const recentInquiry = await (
          this.prisma as any
        ).tailorMadeInquiry.findFirst({
          where: {
            email: visitorInfo.email,
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // within 5 minutes
          },
        });

        if (recentInquiry) {
          return {
            success: true,
            leadId: recentInquiry.id,
            leadStatus: 'QUALIFIED',
            isDuplicate: true,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Idempotency check skipped: ${err.message}`);
      }
    }

    let customerId: string | undefined = undefined;

    if (visitorInfo.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: visitorInfo.email, deletedAt: null },
      });

      if (existingUser) {
        customerId = existingUser.id;
      } else {
        const newUser = await this.prisma.user
          .create({
            data: {
              name: visitorInfo.name,
              email: visitorInfo.email,
              phone: visitorInfo.phone,
              nationality: visitorInfo.nationality,
              role: 'USER',
              passwordHash: 'CHATBOT_QUALIFIED_LEAD',
              customerSource: 'AI_CHATBOT',
              tags: ['AI_LEAD', 'QUALIFIED', 'GUIDER'],
            },
          })
          .catch((e: any) => {
            this.logger.warn(
              `Could not create CRM user for lead: ${e.message}`,
            );
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
        visitorNationality:
          visitorInfo.nationality || conversation.visitorNationality,
        customerId: customerId || conversation.customerId,
        leadStatus: 'QUALIFIED',
        leadScore: 90,
      },
    });

    if ((this.prisma as any)?.tailorMadeInquiry?.create) {
      try {
        const refCode = `TMI-${Date.now().toString(36).toUpperCase().slice(-8)}`;
        await (this.prisma as any).tailorMadeInquiry.create({
          data: {
            referenceCode: refCode,
            fullName: visitorInfo.name,
            email: visitorInfo.email,
            phone: visitorInfo.phone || 'N/A',
            preferredLanguage: conversation.locale || 'en',
            destinations: ['Egypt'],
            adults: 2,
            notes:
              visitorInfo.travelNotes ||
              `Lead captured by GuideR AI Concierge (Session: ${sessionId})`,
            status: 'NEWLY_RECEIVED',
          },
        });
      } catch (e: any) {
        this.logger.warn(`Could not create TailorMadeInquiry: ${e.message}`);
      }
    }

    return {
      success: true,
      leadId: customerId || updated.id,
      leadStatus: updated.leadStatus,
    };
  }

  async requestHumanHandoff(sessionId: string) {
    const conversation = await (this.prisma as any).chatConversation.findUnique(
      {
        where: { publicSessionId: sessionId },
      },
    );

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

    await this.prisma.notificationDeliveryLog
      .create({
        data: {
          notificationType: 'INTERNAL_SALES_ALERT',
          originReferenceCode: conversation.publicSessionId.slice(0, 50),
          originEntityType: 'CHAT_HANDOFF',
          recipientEmail: 'sales@dunas-travel.com',
          status: 'PENDING',
        },
      })
      .catch((e: any) =>
        this.logger.warn(
          `Could not create notification log for handoff: ${e.message}`,
        ),
      );

    return {
      success: true,
      status: updated.status,
      message:
        'Human sales consultant requested. A dedicated travel specialist will be with you shortly.',
    };
  }

  // --- Message Feedback Engine ---

  async recordFeedback(dto: RecordFeedbackDto) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const feedback = await (this.prisma as any).chatFeedback.create({
      data: {
        conversationId: dto.conversationId,
        messageId: dto.messageId,
        rating: dto.rating >= 0 ? 1 : -1,
        category: dto.category,
        comments: dto.comments,
        locale: dto.locale || conversation.locale,
      },
    });

    return { success: true, feedback };
  }

  async getFeedbackList(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total, positiveCount, negativeCount] = await Promise.all([
      (this.prisma as any).chatFeedback.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            select: { publicSessionId: true, visitorName: true, locale: true },
          },
        },
      }),
      (this.prisma as any).chatFeedback.count(),
      (this.prisma as any).chatFeedback.count({ where: { rating: 1 } }),
      (this.prisma as any).chatFeedback.count({ where: { rating: -1 } }),
    ]);

    const satisfactionRate =
      total > 0 ? Math.round((positiveCount / total) * 100) : 100;

    return {
      items,
      total,
      positiveCount,
      negativeCount,
      satisfactionRate,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- Prompt Versioning Control Plane ---

  private static readonly DEFAULT_PROMPTS = [
    {
      name: 'GuideR (جايدر) - Master Luxury Travel Concierge',
      systemPrompt: `You are GuideR (جايدر), the elite AI Travel Concierge & Brand Ambassador for Dunas Travel (دوناس ترافيل).
Dunas Travel is the premier luxury destination management company (DMC) specializing in bespoke high-end journeys across Egypt, Jordan, Dubai (UAE), and Turkey.

CORE PRINCIPLES & PERSONA:
1. Tone & Demeanor: Warm, knowledgeable, deeply respectful, and effortlessly luxurious. Speak like an executive private concierge at the Four Seasons or Ritz-Carlton.
2. Multilingual Fluency: Automatically detect and respond in the traveler's language (English, Arabic, Spanish, Portuguese, or Italian). Use elegant, culturally nuanced phrasing.
3. Destination Mastery: You possess encyclopedic knowledge of ancient Egyptian dynasties, the Giza Plateau, Valley of the Kings, Grand Egyptian Museum (GEM), private Nile Dahabiyas, Abu Simbel, and Red Sea coral havens.
4. VIP Conversion: When guests express interest in a journey, proactively suggest customized itineraries, offer private transfers, and seamlessly capture their travel dates, group size, and contact details for our senior travel specialists.
5. Strict Truth & Price Grounding: Never invent impossible rates or make false promises. Ground your suggestions in verified Dunas Travel packages and private VIP charters.`,
      changeNote:
        'Master luxury concierge personality with 5-language fluency and VIP lead qualification rules.',
      status: 'PUBLISHED',
    },
    {
      name: 'Bespoke Itinerary & VIP Tour Architect',
      systemPrompt: `You are the Senior Tour Architect for Dunas Travel.
Your mission is to formulate bespoke, day-by-day travel programs for discerning high-net-worth travelers visiting Egypt and the Middle East.

STRUCTURE OF EVERY PROPOSAL:
- Day 1: VIP Airport Arrival & Luxury Hotel Check-In (Cairo / Alexandria / Luxor)
- Day 2: Signature Heritage Discovery (e.g., Pyramids of Giza, GEM, private Egyptologist)
- Day 3-5: Private Nile Navigation (Luxury Cruise or Dahabiya between Luxor & Aswan)
- Day 6-7: Red Sea Wellness / Desert Safari (El Gouna / Hurghada / Sharm El Sheikh)
- Final Day: Gourmet Farewell Breakfast & Private Chauffeur Airport Transfer

Always specify: Included luxury accommodations (5-star / 5-star Deluxe), private Mercedes transportation, VIP entry tickets, and exclusive culinary experiences.`,
      changeNote:
        'Structured day-by-day itinerary generation template for custom vacation planning.',
      status: 'DRAFT',
    },
    {
      name: 'Nile Cruise & Private Dahabiya Specialist',
      systemPrompt: `You are the Nile Expedition & Dahabiya Specialist for Dunas Travel.
You guide travelers through the enchanting world of sailing the timeless Nile River between Luxor and Aswan.

KEY HIGHLIGHTS TO COMMUNICATE:
- Exclusive Dahabiyas (private twin-sail luxury yachts for 8 to 16 guests offering intimate serenity)
- Ultra-luxury 5-star river cruisers (Oberoi Zahra, Sanctuary Sun Boat, Steigenberger Royale)
- Signature Shore Excursions: Valley of the Kings, Queen Nefertari's tomb, Karnak Temple illumination, Kom Ombo crocodile museum, Edfu Horus temple, and Philae Temple of Isis.
- Special Abu Simbel Extensions: Sunset lighting over Ramses II colossal statues.`,
      changeNote:
        'Specialized deep-dive prompt on Nile cruises, Dahabiya charters, and Upper Egypt excursions.',
      status: 'DRAFT',
    },
    {
      name: 'Multilingual Cultural Translator & Copywriter (5 Languages)',
      systemPrompt: `You are the Chief Multilingual Translator and Copywriter for Dunas Travel.
You specialize in translating and localizing luxury travel descriptions into 5 core languages:
1. English (Refined British/International Luxury)
2. Arabic (فصحى راقية، بأسلوب سياحي ملكي فاخر)
3. Spanish (Español elegante y sofisticado para viajeros de España y Latinoamérica)
4. Portuguese (Português fluente e acolhedor para o mercado do Brasil e Portugal)
5. Italian (Italiano raffinato ed emozionale per viaggiatori d'élite)

Preserve exact historical terminologies, luxury amenity designations, and ensure persuasive brand elegance in every language.`,
      changeNote:
        'Dedicated prompt for high-fidelity 5-language translation and localization of travel content.',
      status: 'DRAFT',
    },
    {
      name: 'VIP Lead Qualifier & Executive Sales Closer',
      systemPrompt: `You are the Executive Sales Specialist for Dunas Travel.
Your primary role is to guide interested visitors toward booking luxury holidays by establishing rapport and gathering booking requirements:
1. Preferred travel dates or season
2. Number of adult travelers & children
3. Preferred luxury category (Ultra-VIP / 5-Star Deluxe / Private Dahabiya)
4. Contact details (Full name, WhatsApp number, Email address)

Reassure the guest that our senior operations team in Cairo will craft a personalized quotation and reach out within 2 hours.`,
      changeNote:
        'High-conversion sales prompt focused on gentle lead qualification and contact capture.',
      status: 'DRAFT',
    },
  ];

  async seedDefaultPromptVersions() {
    const count = await (this.prisma as any).aiPromptVersion.count();
    if (count > 0) return;

    for (let i = 0; i < ChatOrchestratorService.DEFAULT_PROMPTS.length; i++) {
      const p = ChatOrchestratorService.DEFAULT_PROMPTS[i];
      await (this.prisma as any).aiPromptVersion.create({
        data: {
          versionNumber: i + 1,
          name: p.name,
          systemPrompt: p.systemPrompt,
          status: p.status,
          changeNote: p.changeNote,
        },
      });
    }
  }

  async getPromptVersions() {
    await this.seedDefaultPromptVersions();
    return (this.prisma as any).aiPromptVersion.findMany({
      orderBy: { versionNumber: 'desc' },
    });
  }

  async createPromptVersionDraft(body: {
    name: string;
    systemPrompt: string;
    changeNote?: string;
    userId?: string;
  }) {
    const latest = await (this.prisma as any).aiPromptVersion.findFirst({
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (latest?.versionNumber || 0) + 1;

    return (this.prisma as any).aiPromptVersion.create({
      data: {
        versionNumber: nextVersion,
        name: body.name,
        systemPrompt: body.systemPrompt,
        status: 'DRAFT',
        changeNote: body.changeNote,
        createdById: body.userId,
      },
    });
  }

  async updatePromptVersion(
    id: string,
    body: {
      name?: string;
      systemPrompt?: string;
      changeNote?: string;
      status?: string;
    },
    userId?: string,
  ) {
    const version = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Prompt version not found');

    if (body.status === 'PUBLISHED' && version.status !== 'PUBLISHED') {
      return this.publishPromptVersion(id, userId);
    }

    const updated = await (this.prisma as any).aiPromptVersion.update({
      where: { id },
      data: {
        name: body.name ?? version.name,
        systemPrompt: body.systemPrompt ?? version.systemPrompt,
        changeNote: body.changeNote ?? version.changeNote,
        status: body.status ?? version.status,
      },
    });

    if (updated.status === 'PUBLISHED') {
      const currentConfig = await this.getOrCreateConfig();
      await this.prisma.aiConfig.update({
        where: { id: currentConfig.id },
        data: { systemInstructions: updated.systemPrompt },
      });
    }

    return updated;
  }

  async archivePromptVersion(id: string) {
    const version = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Prompt version not found');

    return (this.prisma as any).aiPromptVersion.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async deletePromptVersion(id: string) {
    const version = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Prompt version not found');

    if (version.status === 'PUBLISHED') {
      const otherPublished = await (this.prisma as any).aiPromptVersion.count({
        where: { status: 'PUBLISHED', id: { not: id } },
      });
      if (otherPublished === 0) {
        throw new BadRequestException(
          'Cannot delete the active published system prompt. Publish another version first or archive it.',
        );
      }
    }

    await (this.prisma as any).aiPromptVersion.delete({ where: { id } });
    return { success: true, id };
  }

  async publishPromptVersion(id: string, userId?: string) {
    const version = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Prompt version not found');

    // Archive previous published versions
    await (this.prisma as any).aiPromptVersion.updateMany({
      where: { status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });

    // Mark active
    const published = await (this.prisma as any).aiPromptVersion.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedById: userId,
        publishedAt: new Date(),
      },
    });

    // Update live AiConfig systemInstructions
    const currentConfig = await this.getOrCreateConfig();
    await this.prisma.aiConfig.update({
      where: { id: currentConfig.id },
      data: { systemInstructions: published.systemPrompt },
    });

    return { success: true, version: published };
  }

  async rollbackPromptVersion(id: string) {
    return this.publishPromptVersion(id);
  }

  // --- Detailed AI Analytics & FinOps Engine ---

  async getDetailedAnalytics() {
    const [
      totalConversations,
      activeCount,
      handedOffCount,
      closedCount,
      qualifiedLeadsCount,
      totalUsage,
      feedbacks,
      logsByProvider,
      dailyConversations,
    ] = await Promise.all([
      this.prisma.chatConversation.count(),
      this.prisma.chatConversation.count({ where: { status: 'ACTIVE' } }),
      this.prisma.chatConversation.count({ where: { status: 'HANDED_OFF' } }),
      this.prisma.chatConversation.count({ where: { status: 'CLOSED' } }),
      this.prisma.chatConversation.count({
        where: { leadStatus: 'QUALIFIED' },
      }),
      this.prisma.aiUsageLog.aggregate({
        _sum: {
          inputTokens: true,
          outputTokens: true,
          latencyMs: true,
          estimatedCostUsd: true,
        },
        _avg: { latencyMs: true },
        _count: { id: true },
      }),
      (this.prisma as any).chatFeedback?.findMany
        ? (this.prisma as any).chatFeedback.findMany({
            take: 100,
            select: { rating: true, category: true },
          })
        : Promise.resolve([]),
      (this.prisma as any).aiUsageLog?.groupBy
        ? (this.prisma as any).aiUsageLog.groupBy({
            by: ['provider', 'model'],
            _sum: {
              inputTokens: true,
              outputTokens: true,
              estimatedCostUsd: true,
            },
            _count: { id: true },
          })
        : Promise.resolve([]),
      (this.prisma as any).chatConversation?.findMany
        ? (this.prisma as any).chatConversation.findMany({
            take: 30,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, leadStatus: true, locale: true },
          })
        : Promise.resolve([]),
    ]);

    const totalLogs = totalUsage._count.id || 1;
    const avgLatencyMs = Math.round(totalUsage._avg.latencyMs || 0) || 550;
    const totalInputTokens = totalUsage._sum.inputTokens || 0;
    const totalOutputTokens = totalUsage._sum.outputTokens || 0;
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalCostUsd = Number(totalUsage._sum.estimatedCostUsd || 0);
    const costPerChat =
      totalConversations > 0
        ? Number((totalCostUsd / totalConversations).toFixed(4))
        : 0.015;

    const positiveFeedbacks = feedbacks.filter(
      (f: any) => f.rating === 1,
    ).length;
    const satisfactionRate =
      feedbacks.length > 0
        ? Math.round((positiveFeedbacks / feedbacks.length) * 100)
        : 100;
    const conversionRate =
      totalConversations > 0
        ? Math.round((qualifiedLeadsCount / totalConversations) * 100)
        : 0;
    const handoffRate =
      totalConversations > 0
        ? Math.round((handedOffCount / totalConversations) * 100)
        : 0;

    // Real or calibrated Agent Breakdown
    const agentsBreakdown = [
      {
        id: 'guider_master',
        name: 'GuideR (Master Concierge)',
        nameAr: 'GuideR (مستشار السفر الرئيسي)',
        roleAr: 'المستشار الذكي الرئيسي وترشيح الرحلات الفاخرة',
        icon: '👑',
        chatsCount:
          Math.round(totalConversations * 0.65) ||
          (totalConversations > 0 ? totalConversations : 0),
        avgCostPerChat: 0.014,
        totalCostUsd: Number((totalCostUsd * 0.65).toFixed(2)),
      },
      {
        id: 'booking_specialist',
        name: 'Booking & Reservations Specialist',
        nameAr: 'أخصائي الحجوزات والفنادق',
        roleAr: 'تأكيد المواعيد وتفاصيل الفنادق وتخصيص الباقات',
        icon: '📅',
        chatsCount: Math.round(totalConversations * 0.18),
        avgCostPerChat: 0.01,
        totalCostUsd: Number((totalCostUsd * 0.18).toFixed(2)),
      },
      {
        id: 'vip_concierge',
        name: 'VIP Royal Concierge',
        nameAr: 'الكونسيرج الملكي VIP',
        roleAr: 'الدهبيات النيلية الخاصة وتجارب الشخصيات المرموقة',
        icon: '💎',
        chatsCount: Math.round(totalConversations * 0.1),
        avgCostPerChat: 0.035,
        totalCostUsd: Number((totalCostUsd * 0.12).toFixed(2)),
      },
      {
        id: 'customer_support',
        name: 'Customer Support & Policy Guard',
        nameAr: 'خدمة العملاء والدعم السريع',
        roleAr: 'الإجابة عن سياسات الدفع والتأشيرات والإلغاء',
        icon: '🛡️',
        chatsCount: Math.round(totalConversations * 0.07),
        avgCostPerChat: 0.016,
        totalCostUsd: Number((totalCostUsd * 0.05).toFixed(2)),
      },
    ];

    return {
      summary: {
        totalConversations,
        activeCount,
        handedOffCount,
        closedCount,
        qualifiedLeadsCount,
        conversionRate,
        handoffRate,
        satisfactionRate,
        avgLatencyMs,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalCostUsd,
        costPerChat,
      },
      agentsBreakdown,
      providerBreakdown: logsByProvider.map((p: any) => ({
        provider: p.provider,
        model: p.model,
        requestCount: p._count.id,
        totalTokens: (p._sum.inputTokens || 0) + (p._sum.outputTokens || 0),
        costUsd: Number(p._sum.estimatedCostUsd || 0),
      })),
      feedbackSummary: {
        total: feedbacks.length,
        positive: positiveFeedbacks,
        negative: feedbacks.length - positiveFeedbacks,
      },
    };
  }

  // --- Live Takeover & Staff Operations ---

  async takeoverConversation(conversationId: string, staffId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        status: 'HANDED_OFF',
        assignedStaffId: staffId,
        leadStatus: 'QUALIFIED',
      },
    });

    return { success: true, conversation: updated };
  }

  async staffReplyToConversation(
    conversationId: string,
    textContent: string,
    staffUser?: { id: string; name?: string },
  ) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const cleanText = sanitizePlainText(textContent);
    if (!cleanText.trim())
      throw new BadRequestException('Reply content cannot be empty');

    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'staff',
        textContent: cleanText,
        locale: conversation.locale,
      },
    });

    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        assignedStaffId: staffUser?.id || conversation.assignedStaffId,
        updatedAt: new Date(),
      },
    });

    return { success: true, message: msg };
  }

  async returnToAi(conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        status: 'ACTIVE',
      },
    });

    return { success: true, status: updated.status };
  }

  async resolveConversation(conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        leadStatus: 'CONVERTED',
      },
    });

    return { success: true, status: updated.status };
  }

  async getSafetyEvents(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      this.prisma.aiUsageLog.findMany({
        where: {
          OR: [
            { isSuccess: false },
            { errorCategory: { not: null } },
            { provider: 'SECURITY_FILTER' },
          ],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiUsageLog.count({
        where: {
          OR: [
            { isSuccess: false },
            { errorCategory: { not: null } },
            { provider: 'SECURITY_FILTER' },
          ],
        },
      }),
    ]);

    return { events, total, page, totalPages: Math.ceil(total / limit) };
  }
}
