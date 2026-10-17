import { Test, TestingModule } from '@nestjs/testing';
import {
  ChatOrchestratorService,
  AI_PERSONAS,
} from './services/chat-orchestrator.service';
import { TourCatalogToolService } from './services/tour-catalog-tool.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiKeyPoolService } from './services/ai-key-pool.service';
import { RagRetrievalService } from './services/rag-retrieval.service';

describe('GuideR Intent Classification & Catalog Gating Unit Tests', () => {
  let orchestrator: ChatOrchestratorService;
  let catalogTool: TourCatalogToolService;

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
        welcomeMessages: { ar: 'أهلاً بك' },
        suggestedQuestions: { ar: ['اقترح رحلة'] },
        tourSettings: { apiKeysPool: [] },
      }),
    },
    chatConversation: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'conv-test-1',
        publicSessionId: 'sess-test-1',
        status: 'ACTIVE',
        leadStatus: 'NEW',
        messages: [],
        travelPreferences: {},
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    chatMessage: {
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'msg-' + Date.now(),
        ...data,
        createdAt: new Date(),
      })),
    },
    aiUsageLog: {
      create: jest.fn().mockResolvedValue({}),
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
      escalationMessage: 'Escalation message',
      welcomeMessages: { ar: 'أهلاً بك' },
      suggestedQuestions: { ar: ['اقترح رحلة'] },
      tourSettings: { apiKeysPool: [] },
    }),
    executeWithFailover: jest.fn().mockResolvedValue({
      text: 'إجابة تجريبية راقية من مستشار السفر الذكي دون ذكر أي ألقاب عفا عليها الزمن.',
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

    orchestrator = module.get<ChatOrchestratorService>(ChatOrchestratorService);
    catalogTool = module.get<TourCatalogToolService>(TourCatalogToolService);

    // Mock searchGroundedTours to verify when it gets called
    jest.spyOn(catalogTool, 'searchGroundedTours').mockResolvedValue([
      {
        id: 'tour-101',
        title: 'Nile Cruise 5 Stars',
        slug: 'nile-cruise-5-stars',
        destination: 'Egypt',
        price: 850,
        currency: 'USD',
        matchScore: 45,
        matchReasons: ['Explicit cruise request'],
        publicUrl: '/tours/nile-cruise-5-stars',
      },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Zero Archaic Honorifics Policy', () => {
    it('should explicitly instruct NEVER to use archaic honorifics across all personas', () => {
      for (const persona of AI_PERSONAS) {
        expect(persona.systemPromptAddendum).toContain('Zero Honorifics');
        expect(persona.systemPromptAddendum).toContain(
          'NEVER address the traveler with',
        );
      }
    });
  });

  describe('Grounded Intent Classification & Zero Catalog Dumping', () => {
    it('should treat weather / best time questions as informational text with NO tour cards', async () => {
      const searchSpy = jest.spyOn(catalogTool, 'searchGroundedTours');

      const result = await orchestrator.processVisitorMessage({
        sessionId: 'sess-test-1',
        message: 'ما هو أفضل وقت لزيارة مصر واعتدال الطقس؟',
        locale: 'ar',
      });

      expect(result.responseType).toBe('text');
      expect(result.intent).toBe('informational');
      expect(result.recommendations.tours).toEqual([]);
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it('should classify general greeting as text intent without unsolicited tour cards', async () => {
      const searchSpy = jest.spyOn(catalogTool, 'searchGroundedTours');

      const result = await orchestrator.processVisitorMessage({
        sessionId: 'sess-test-1',
        message: 'مرحبا، من أنت؟',
        locale: 'ar',
      });

      expect(result.responseType).toBe('text');
      expect(result.intent).toBe('greeting');
      expect(result.recommendations.tours).toEqual([]);
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it('should classify explicit tour inquiry as recommendation and search catalog tours', async () => {
      const searchSpy = jest.spyOn(catalogTool, 'searchGroundedTours');

      const result = await orchestrator.processVisitorMessage({
        sessionId: 'sess-test-1',
        message: 'اقترح علي أفضل رحلات النايل كروز الفاخرة 5 نجوم',
        locale: 'ar',
      });

      expect(result.responseType).toBe('recommendation');
      expect(result.intent).toBe('tour_recommendation');
      expect(searchSpy).toHaveBeenCalled();
      expect(result.recommendations.tours.length).toBeGreaterThan(0);
    });

    it('should classify custom itinerary request and generate structured proposal', async () => {
      const result = await orchestrator.processVisitorMessage({
        sessionId: 'sess-test-1',
        message:
          'صمم لي برنامج سياحي مخصص 7 أيام في القاهرة والأقصر مع نايل كروز',
        locale: 'ar',
      });

      expect(result.responseType).toBe('itinerary');
      expect(result.intent).toBe('custom_itinerary');
      expect(result.recommendations.proposal).toBeDefined();
    });

    it('should classify booking inquiries as booking_intent without unsolicited booking creation', async () => {
      const result = await orchestrator.processVisitorMessage({
        sessionId: 'sess-test-1',
        message: 'كيف أحجز هذه الرحلة؟ أريد حجز البرنامج الآن',
        locale: 'ar',
      });

      expect(result.responseType).toBe('booking_intent');
      expect(result.intent).toBe('booking_request');
    });
  });
});
