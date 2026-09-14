import { Test, TestingModule } from '@nestjs/testing';
import { ResponseInvariantNormalizer } from './services/guider-invariants';
import { TourCatalogToolService, TravelConstraints, GroundedTourRecommendation } from './services/tour-catalog-tool.service';
import { ChatOrchestratorService, GuiderOrchestratorResponse } from './services/chat-orchestrator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiKeyPoolService } from './services/ai-key-pool.service';
import { RagRetrievalService } from './services/rag-retrieval.service';

describe('GuideR Response Invariants, Negation Resistance & Idempotency Tests', () => {
  let catalogTool: TourCatalogToolService;
  let orchestrator: ChatOrchestratorService;

  const mockPrisma: any = {
    aiConfig: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        provider: 'google',
        model: 'gemini-3.7-flash',
        isEnabled: true,
        isPublicEnabled: true,
        systemInstructions: 'GuideR instructions',
        fallbackMessage: 'Fallback message',
        escalationMessage: 'Escalation message',
        tourSettings: { apiKeysPool: [] },
      }),
    },
    chatConversation: {
      findUnique: jest.fn().mockImplementation(({ where }) => ({
        id: 'conv-test-1',
        publicSessionId: where.publicSessionId || 'sess-test-1',
        status: 'ACTIVE',
        leadStatus: 'NEW',
        messages: [],
        travelPreferences: {},
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    chatMessage: {
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'msg-' + Math.random().toString(36).substring(2, 8),
        ...data,
        createdAt: new Date(),
      })),
    },
    aiUsageLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    tour: {
      findMany: jest.fn(),
    },
    destination: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockKeyPool: any = {
    getAiConfig: jest.fn().mockResolvedValue({
      id: 'cfg-1',
      provider: 'google',
      model: 'gemini-3.7-flash',
      isEnabled: true,
      isPublicEnabled: true,
      systemInstructions: 'GuideR instructions',
      fallbackMessage: 'Fallback message',
    }),
    executeWithFailover: jest.fn().mockResolvedValue({
      text: 'إجابة تجريبية راقية من مستشار السفر الذكي.',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 150,
      provider: 'google',
      model: 'gemini-3.7-flash',
    }),
  };

  const mockRagRetrieval: any = {
    retrieveRelevantKnowledge: jest.fn().mockResolvedValue([]),
  };

  const mockAvailability: any = {
    getStatus: jest.fn().mockResolvedValue({ enabled: true, status: 'ACTIVE' }),
  };

  const mockEventEmitter: any = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatOrchestratorService,
        TourCatalogToolService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiKeyPoolService, useValue: mockKeyPool },
        { provide: RagRetrievalService, useValue: mockRagRetrieval },
        { provide: AvailabilityService, useValue: mockAvailability },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    catalogTool = module.get<TourCatalogToolService>(TourCatalogToolService);
    orchestrator = module.get<ChatOrchestratorService>(ChatOrchestratorService);
  });

  describe('1. Authoritative Response Invariant Normalizer', () => {
    it('purges tours, proposal, comparison and lead capture from text responses', () => {
      const input: GuiderOrchestratorResponse = {
        conversationId: 'c-1',
        responseType: 'text',
        intent: 'general_chat',
        message: {
          id: 'm-1',
          role: 'assistant',
          content: 'Here is some general information about Egypt.',
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [{ id: 't-1', title: 'Leaked Tour', destination: 'Cairo', durationDays: 3, price: 500, currency: 'USD' }],
          destinations: [],
          proposal: { title: 'Leaked Proposal', destinations: ['Cairo'], days: [] },
          comparison: { tours: [] },
        },
        suggestedReplies: ['Tell me more'],
        actions: [],
        handoff: { available: true, requested: false, status: 'ACTIVE' },
        leadCapture: { required: true, fields: ['name', 'email'] },
        sources: [],
      };

      const normalized = ResponseInvariantNormalizer.normalizeAndValidate(input, 'en');

      expect(normalized.responseType).toBe('text');
      expect(normalized.recommendations.tours).toEqual([]);
      expect(normalized.recommendations.proposal).toBeFalsy();
      expect(normalized.recommendations.comparison).toBeFalsy();
      expect(normalized.leadCapture.required).toBe(false);
    });

    it('downgrades recommendation with 0 matching tours to text and injects polite fallback guidance', () => {
      const input: GuiderOrchestratorResponse = {
        conversationId: 'c-2',
        responseType: 'recommendation',
        intent: 'tour_search',
        message: {
          id: 'm-2',
          role: 'assistant',
          content: 'Here are the recommended tours for your request:',
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [],
          destinations: [],
        },
        suggestedReplies: [],
        actions: [],
        handoff: { available: true, requested: false, status: 'ACTIVE' },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };

      const normalized = ResponseInvariantNormalizer.normalizeAndValidate(input, 'ar');

      expect(normalized.responseType).toBe('text');
      expect(normalized.message.content).toContain('لم نجد حالياً باقة في الكتالوج');
      expect(normalized.recommendations.tours).toEqual([]);
    });

    it('downgrades itinerary response to text if proposal is missing or has 0 days', () => {
      const input: GuiderOrchestratorResponse = {
        conversationId: 'c-3',
        responseType: 'itinerary',
        intent: 'itinerary_planning',
        message: {
          id: 'm-3',
          role: 'assistant',
          content: 'Here is your custom itinerary:',
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [],
          destinations: [],
          proposal: { title: 'Empty proposal', destinations: [], days: [] },
        },
        suggestedReplies: [],
        actions: [],
        handoff: { available: true, requested: false, status: 'ACTIVE' },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };

      const normalized = ResponseInvariantNormalizer.normalizeAndValidate(input, 'en');

      expect(normalized.responseType).toBe('text');
      expect(normalized.recommendations.proposal).toBeFalsy();
    });

    it('downgrades comparison response if fewer than 2 tours are provided', () => {
      const input: GuiderOrchestratorResponse = {
        conversationId: 'c-4',
        responseType: 'comparison',
        intent: 'comparison',
        message: {
          id: 'm-4',
          role: 'assistant',
          content: 'Comparing selected tours:',
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [{ id: 't-1', title: 'Single Tour', destination: 'Luxor', durationDays: 4, price: 800, currency: 'USD' }],
          destinations: [],
          comparison: {
            tours: [{ id: 't-1', title: 'Single Tour', destination: 'Luxor', durationDays: 4, price: 800, currency: 'USD' }],
          },
        },
        suggestedReplies: [],
        actions: [],
        handoff: { available: true, requested: false, status: 'ACTIVE' },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };

      const normalized = ResponseInvariantNormalizer.normalizeAndValidate(input, 'en');

      // Since only 1 tour was present, comparison is invalid; downgraded to recommendation
      expect(normalized.responseType).toBe('recommendation');
      expect(normalized.recommendations.comparison).toBeFalsy();
      expect(normalized.recommendations.tours.length).toBe(1);
    });

    it('intercepts and sanitizes false booking confirmations in booking_intent', () => {
      const input: GuiderOrchestratorResponse = {
        conversationId: 'c-5',
        responseType: 'booking_intent',
        intent: 'booking_intent',
        message: {
          id: 'm-5',
          role: 'assistant',
          content: 'تم تأكيد حجزك بنجاح للرحلة! نتمنى لك إقامة سعيدة.',
          structuredContent: {
            booking: { confirmed: true, reference: 'FAKEREF' },
          },
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [{ id: 't-1', title: 'Cairo VIP Tour', destination: 'Cairo', durationDays: 3, price: 600, currency: 'USD', slug: 'cairo-vip' }],
          destinations: [],
        },
        suggestedReplies: [],
        actions: [],
        handoff: { available: true, requested: false, status: 'ACTIVE' },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };

      const normalized = ResponseInvariantNormalizer.normalizeAndValidate(input, 'ar');

      // Content must NOT claim confirmed booking
      expect(normalized.message.content).not.toContain('تم تأكيد حجزك');
      expect(normalized.message.content).toContain('صفحة الرحلة الرسمية');
      expect(normalized.message.structuredContent.booking).toBeFalsy();
    });

    it('deduplicates recommendations by tour ID and slug', () => {
      const input: GuiderOrchestratorResponse = {
        conversationId: 'c-6',
        responseType: 'recommendation',
        intent: 'tour_search',
        message: {
          id: 'm-6',
          role: 'assistant',
          content: 'Recommendations:',
          createdAt: new Date().toISOString(),
        },
        recommendations: {
          tours: [
            { id: 't-1', slug: 'cairo-tour', title: 'Cairo Tour', destination: 'Cairo', durationDays: 3, price: 500, currency: 'USD' },
            { id: 't-1', slug: 'cairo-tour', title: 'Cairo Tour Dup', destination: 'Cairo', durationDays: 3, price: 500, currency: 'USD' },
            { id: 't-2', slug: 'cairo-tour', title: 'Same Slug Tour', destination: 'Cairo', durationDays: 3, price: 500, currency: 'USD' },
            { id: 't-3', slug: 'luxor-tour', title: 'Luxor Tour', destination: 'Luxor', durationDays: 4, price: 700, currency: 'USD' },
          ],
          destinations: [],
        },
        suggestedReplies: [],
        actions: [],
        handoff: { available: true, requested: false, status: 'ACTIVE' },
        leadCapture: { required: false, fields: [] },
        sources: [],
      };

      const normalized = ResponseInvariantNormalizer.normalizeAndValidate(input, 'en');

      expect(normalized.recommendations.tours.length).toBe(2);
      expect(normalized.recommendations.tours.map((t) => t.id)).toEqual(['t-1', 't-3']);
    });
  });

  describe('2. Negation Resistance in Travel Constraints', () => {
    it('detects explicit Nile Cruise negation: "بدون كروز" / "no cruise"', () => {
      const resAr = catalogTool.extractTravelConstraints('عايز رحلة 7 أيام في الأقصر وأسوان بس بدون كروز أو مراكب');
      expect(resAr.nileCruiseRequired).toBe(false);

      const resEn = catalogTool.extractTravelConstraints('I want a 5-day Luxor trip, no cruise, land only');
      expect(resEn.nileCruiseRequired).toBe(false);
    });

    it('detects explicit Beach negation: "بدون شواطئ" / "no beach"', () => {
      const resAr = catalogTool.extractTravelConstraints('رحلة ثقافية في مصر بدون شواطئ أو بحر');
      expect(resAr.beachRequired).toBe(false);

      const resEn = catalogTool.extractTravelConstraints('Cultural tour without beach or diving');
      expect(resEn.beachRequired).toBe(false);
    });

    it('handles duration negation: "مش 7 أيام، 10 أيام"', () => {
      const res = catalogTool.extractTravelConstraints('عايز برنامج سياحي مش 7 أيام، 10 أيام');
      expect(res.targetDuration).toBe(10);
      expect(res.durationDays).toBe(10);
    });

    it('parses currency and budget correctly for EGP vs USD', () => {
      const egpRes = catalogTool.extractTravelConstraints('ميزانيتي 60000 جنيه للرحلة');
      expect(egpRes.maxBudget).toBe(60000);
      expect(egpRes.currency).toBe('EGP');

      const usdRes = catalogTool.extractTravelConstraints('My budget is around $3500 for two people');
      expect(usdRes.maxBudget).toBe(3500);
      expect(usdRes.currency).toBe('USD');
    });

    it('filters out negated destinations: "مش دبي، عايز أسوان"', () => {
      const res = catalogTool.extractTravelConstraints('مش عايز دبي، عايز رحلة في أسوان والقاهرة');
      expect(res.destinations).toContain('Aswan');
      expect(res.destinations).toContain('Cairo');
      expect(res.destinations).not.toContain('Dubai');
    });
  });

  describe('3. Hard Constraint Enforcement in Catalog Search', () => {
    it('disqualifies tours exceeding maxBudget by more than 20% (Hard Budget Exclusion)', async () => {
      mockPrisma.tour.findMany.mockResolvedValueOnce([
        {
          id: 't-cheap',
          slug: 't-cheap',
          titleJsonb: { en: 'Budget Friendly Tour', ar: 'رحلة اقتصادية' },
          durationDays: 4,
          basePriceUsd: 1000,
          city: 'Cairo',
          country: 'Egypt',
          tags: ['cairo'],
          isFeatured: true,
          status: 'PUBLISHED',
          images: [{ imageUrl: 'https://img.jpg', isHero: true }],
        },
        {
          id: 't-expensive',
          slug: 't-expensive',
          titleJsonb: { en: 'Overbudget Tour', ar: 'رحلة غالية' },
          durationDays: 4,
          basePriceUsd: 3500, // 3500 > 1000 * 1.2 = 1200
          city: 'Cairo',
          country: 'Egypt',
          tags: ['cairo'],
          isFeatured: true,
          status: 'PUBLISHED',
          images: [{ imageUrl: 'https://img.jpg', isHero: true }],
        },
      ]);

      const results = await catalogTool.searchGroundedTours(
        [],
        4,
        'en',
        { maxBudget: 1000, currency: 'USD' }
      );

      const ids = results.map((t) => t.id);
      expect(ids).toContain('t-cheap');
      expect(ids).not.toContain('t-expensive');
    });

    it('strictly excludes cruise tours when nileCruiseRequired is false', async () => {
      mockPrisma.tour.findMany.mockResolvedValueOnce([
        {
          id: 't-hotel',
          slug: 't-hotel',
          titleJsonb: { en: 'Luxor Land & Hotel Tour', ar: 'فنادق الأقصر البرية' },
          durationDays: 4,
          basePriceUsd: 900,
          city: 'Luxor',
          country: 'Egypt',
          tags: ['hotel', 'luxor'],
          isFeatured: true,
          status: 'PUBLISHED',
          images: [{ imageUrl: 'https://img.jpg', isHero: true }],
        },
        {
          id: 't-cruise',
          slug: 't-cruise',
          titleJsonb: { en: '5-Star Nile Cruise Luxury Sailing', ar: 'نايل كروز 5 نجوم فاخر' },
          durationDays: 4,
          basePriceUsd: 1100,
          city: 'Luxor',
          country: 'Egypt',
          tags: ['cruise', 'nile'],
          isFeatured: true,
          status: 'PUBLISHED',
          images: [{ imageUrl: 'https://img.jpg', isHero: true }],
        },
      ]);

      const results = await catalogTool.searchGroundedTours(
        ['Luxor'],
        4,
        'en',
        { nileCruiseRequired: false }
      );

      const ids = results.map((t) => t.id);
      expect(ids).toContain('t-hotel');
      expect(ids).not.toContain('t-cruise');
    });
  });

  describe('4. Negated Intents & Idempotency Caching in Orchestrator', () => {
    it('does not classify "مش عايز احجز، بسأل بس" as booking_intent', async () => {
      const response = await orchestrator.processVisitorMessage({
        message: 'مش عايز احجز دلوقتي، بسأل بس عن أفضل وقت للسفر',
        sessionId: 'test-negate-booking-1',
        locale: 'ar',
      });

      expect(response.intent).not.toBe('booking_intent');
      expect(response.responseType).not.toBe('booking_intent');
    });

    it('returns cached response when idempotencyKey was previously processed', async () => {
      const idempotencyKey = 'idem-test-key-12345';
      const existingMessage = {
        id: 'msg-cached-1',
        role: 'assistant',
        textContent: 'الرد المخبأ مسبقاً بنفس المفتاح.',
        structuredContent: {
          idempotencyKey,
          responseType: 'text',
          intent: 'general_chat',
          tours: [],
        },
        createdAt: new Date(),
      };

      mockPrisma.chatConversation.findUnique.mockResolvedValueOnce({
        id: 'conv-test-idempotent',
        publicSessionId: 'sess-idem-1',
        status: 'ACTIVE',
        leadStatus: 'NEW',
        messages: [existingMessage],
        travelPreferences: {},
      });

      const response = await orchestrator.processVisitorMessage({
        message: 'هل يمكنكم المساعدة؟',
        sessionId: 'sess-idem-1',
        locale: 'ar',
        idempotencyKey,
      });

      expect(response.message.id).toBe('msg-cached-1');
      expect(response.message.content).toBe('الرد المخبأ مسبقاً بنفس المفتاح.');
      // chatMessage.create should NOT have been called again
      expect(mockPrisma.chatMessage.create).not.toHaveBeenCalled();
    });
  });
});
