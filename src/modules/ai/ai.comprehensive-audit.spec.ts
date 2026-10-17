import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AiModule } from './ai.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';
import { AiUsageQuotaService } from './ai-usage-quota.service';
import { AiService } from './ai.service';

describe('Comprehensive AI & Chatbot API Verification Suite', () => {
  let app: INestApplication;

  const mockPrisma: any = {
    aiConfig: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cfg-audit-1',
        provider: 'google',
        model: 'gemini-3.6-flash',
        isEnabled: true,
        isPublicEnabled: true,
        systemInstructions: 'You are GuideR, luxury AI concierge.',
        salesPersonality: 'WARM_LUXURY',
        toneOfVoice: 'ELEGANT',
        fallbackMessage: 'Welcome to Dunas Travel luxury concierge.',
        escalationMessage: 'Connecting you with a private consultant.',
        welcomeMessages: {
          en: 'Welcome to Dunas Travel! How may I craft your dream journey today?',
          ar: 'مرحباً بك في دوناس ترافيل! كيف يمكنني مساعدتك في تصميم رحلتك الفاخرة اليوم؟',
        },
        suggestedQuestions: {
          en: ['Best luxury Nile cruise', 'Private Dahabiya charter'],
          ar: ['أفضل رحلات النايل كروز الفاخرة', 'تأجير دهبية خاصة'],
        },
        tourSettings: { isInChatBookingEnabled: false, apiKeysPool: [] },
        encryptedApiKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      create: jest.fn().mockResolvedValue({ id: 'cfg-audit-1' }),
      update: jest.fn().mockResolvedValue({
        id: 'cfg-audit-1',
        provider: 'google',
        model: 'gemini-3.6-flash',
        isEnabled: true,
        tourSettings: { isInChatBookingEnabled: false },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    aiProviderCredential: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'cred-1',
          provider: 'google',
          model: 'gemini-3.6-flash',
          label: 'Primary Google Gemini Key',
          encryptedApiKey: 'test-enc-key',
          priority: 1,
          isActive: true,
          failCount: 0,
          lastStatus: 'HEALTHY',
          lastLatencyMs: 320,
          lastTestedAt: new Date(),
        },
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'cred-1',
        provider: 'google',
        model: 'gemini-3.6-flash',
        label: 'Primary Google Gemini Key',
        encryptedApiKey: 'test-enc-key',
        priority: 1,
        isActive: true,
        failCount: 0,
        lastStatus: 'HEALTHY',
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'cred-1',
        provider: 'google',
        model: 'gemini-3.6-flash',
        label: 'Primary Google Gemini Key',
        encryptedApiKey: 'test-enc-key',
        priority: 1,
        isActive: true,
        failCount: 0,
        lastStatus: 'HEALTHY',
      }),
      create: jest.fn().mockResolvedValue({
        id: 'cred-new',
        provider: 'google',
        model: 'gemini-3.6-flash',
        label: 'New Gemini Key',
        priority: 2,
        isActive: true,
        failCount: 0,
        lastStatus: 'UNTESTED',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'cred-1',
        provider: 'google',
        model: 'gemini-3.6-flash',
        lastStatus: 'HEALTHY',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'cred-1' }),
      aggregate: jest.fn().mockResolvedValue({ _max: { priority: 1 } }),
    },
    aiPromptVersion: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'prompt-1',
          versionNumber: 1,
          name: 'GuideR Luxury Concierge V1',
          systemPrompt: 'You are GuideR, luxury AI concierge for Dunas Travel.',
          status: 'PUBLISHED',
          createdAt: new Date(),
        },
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'prompt-1',
        versionNumber: 1,
        name: 'GuideR Luxury Concierge V1',
        systemPrompt: 'You are GuideR, luxury AI concierge for Dunas Travel.',
        status: 'PUBLISHED',
      }),
      create: jest.fn().mockResolvedValue({
        id: 'prompt-2',
        versionNumber: 2,
        name: 'Draft Prompt',
        systemPrompt: 'Draft instructions',
        status: 'DRAFT',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'prompt-1',
        status: 'PUBLISHED',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'prompt-1' }),
      count: jest.fn().mockResolvedValue(1),
    },
    chatConversation: {
      count: jest.fn().mockResolvedValue(15),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'conv-audit-1',
          publicSessionId: 'sess-audit-123',
          visitorName: 'Amira Hassan',
          status: 'ACTIVE',
          leadStatus: 'QUALIFIED',
          locale: 'ar',
          updatedAt: new Date(),
          messages: [
            { id: 'm-1', role: 'user', content: 'أريد حجز كروز نيلي 8 أيام' },
          ],
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'conv-audit-1',
        publicSessionId: 'sess-audit-123',
        visitorName: 'Amira Hassan',
        status: 'ACTIVE',
        leadStatus: 'QUALIFIED',
        locale: 'ar',
        messages: [
          {
            id: 'm-1',
            role: 'user',
            content: 'أريد حجز كروز نيلي 8 أيام',
            createdAt: new Date(),
          },
          {
            id: 'm-2',
            role: 'assistant',
            content: 'أهلاً بك! لدينا أرقى برامج النايل كروز الفاخرة.',
            createdAt: new Date(),
          },
        ],
      }),
      create: jest.fn().mockResolvedValue({
        id: 'conv-audit-1',
        publicSessionId: 'sess-audit-123',
        status: 'ACTIVE',
        leadStatus: 'NEW',
        messages: [],
      }),
      update: jest.fn().mockResolvedValue({
        id: 'conv-audit-1',
        status: 'RESOLVED',
      }),
    },
    chatMessage: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'msg-created',
          ...data,
          createdAt: new Date(),
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chatFeedback: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'fb-1',
          conversationId: 'conv-audit-1',
          rating: 1,
          category: 'HELPFUL',
          comments: 'ممتاز وسريع جداً',
          locale: 'ar',
          createdAt: new Date(),
        },
      ]),
      create: jest.fn().mockResolvedValue({ id: 'fb-1', rating: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    aiUsageLog: {
      count: jest.fn().mockResolvedValue(42),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          inputTokens: 12000,
          outputTokens: 8500,
          latencyMs: 25000,
          estimatedCostUsd: 0.045,
        },
        _avg: { latencyMs: 550 },
        _count: { id: 42 },
      }),
      create: jest.fn().mockResolvedValue({ id: 'log-audit-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    aiAgent: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'agent-1',
          slug: 'guider',
          nameJsonb: { en: 'GuideR', ar: 'جايدر' },
          role: 'Travel Concierge',
          systemPrompt: 'You are GuideR',
          isActive: true,
          isPublic: true,
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'agent-1',
        slug: 'guider',
        nameJsonb: { en: 'GuideR', ar: 'جايدر' },
        role: 'Travel Concierge',
        systemPrompt: 'You are GuideR',
        isActive: true,
        isPublic: true,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'agent-1',
        slug: 'guider',
        nameJsonb: { en: 'GuideR', ar: 'جايدر' },
        role: 'Travel Concierge',
        systemPrompt: 'You are GuideR',
        isActive: true,
        isPublic: true,
      }),
      create: jest.fn().mockResolvedValue({ id: 'agent-1' }),
      update: jest.fn().mockResolvedValue({ id: 'agent-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'agent-1' }),
    },
    knowledgeBaseItem: {
      count: jest.fn().mockResolvedValue(10),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'kb-audit-1',
          title: 'سياسة الحجز والإلغاء الرسمية',
          content: 'شروط الإلغاء والاسترداد المعتمدة في دوناس ترافيل.',
          category: 'BOOKING_POLICY',
          locale: 'ar',
          status: 'PUBLISHED',
          isExcludedFromAi: false,
          priority: 20,
          updatedAt: new Date(),
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'kb-audit-1',
        title: 'سياسة الحجز والإلغاء الرسمية',
        content: 'شروط الإلغاء والاسترداد المعتمدة في دوناس ترافيل.',
        category: 'BOOKING_POLICY',
        locale: 'ar',
        status: 'PUBLISHED',
        isExcludedFromAi: false,
      }),
      create: jest.fn().mockResolvedValue({
        id: 'kb-created-1',
        title: 'وثيقة معرفية جديدة',
        content: 'محتوى الوثيقة',
        locale: 'ar',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'kb-audit-1',
        title: 'وثيقة محدثة',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'kb-audit-1' }),
    },
    aiKnowledgeChunk: {
      count: jest.fn().mockResolvedValue(25),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          content:
            'نقدم رحلات كروز نيلية فاخرة 5 نجوم ديلوكس بين الأقصر وأسوان.',
          locale: 'ar',
          entityType: 'TOUR',
        },
      ]),
    },
    tour: {
      count: jest.fn().mockResolvedValue(12),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tour-audit-1',
          slug: 'classic-egypt-nile-8d',
          titleJsonb: {
            en: 'Classic Egypt & Luxury Nile Cruise 8D/7N',
            ar: 'مصر الكلاسيكية وكروز النيل الفاخر 8 أيام',
          },
          category: 'Nile Cruise',
          city: 'Cairo, Luxor, Aswan',
          country: 'Egypt',
          basePriceUsd: 2190,
          currency: 'USD',
          durationDays: 8,
          isActive: true,
          status: 'PUBLISHED',
          isFeatured: true,
          tags: ['nile cruise', 'pyramids', 'cairo', 'luxor'],
          images: [{ imageUrl: '/imgs/tours/classic.webp', isHero: true }],
        },
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'tour-audit-1',
        slug: 'classic-egypt-nile-8d',
        titleJsonb: { ar: 'مصر الكلاسيكية وكروز النيل الفاخر 8 أيام' },
        basePriceUsd: 2190,
        currency: 'USD',
      }),
    },
    tourLandingPage: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'dest-1',
          slug: 'egypt',
          titleJsonb: {
            en: 'Luxury Egypt Destinations',
            ar: 'وجهات مصر الفاخرة',
          },
          isActive: true,
          status: 'PUBLISHED',
          sortOrder: 1,
        },
      ]),
    },
    hotel: {
      count: jest.fn().mockResolvedValue(8),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'VIP Traveler',
        email: 'vip@traveler.com',
        bookings: [],
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'usr-new-1', email: 'traveler@example.com' }),
    },
    tailorMadeInquiry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'inq-1', referenceCode: 'TMI-123' }),
    },
    notificationDeliveryLog: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), AiModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          if (key === 'GEMINI_API_KEY')
            return 'AIzaSyMockKeyForComprehensiveVerificationTest';
          if (key === 'REDIS_URL') return 'redis://localhost:6379';
          return null;
        }),
        getOrThrow: jest.fn((key: string) => {
          if (key === 'REDIS_URL') return 'redis://localhost:6379';
          return 'mock-val';
        }),
      })
      .overrideProvider(AiUsageQuotaService)
      .useValue({
        consume: jest.fn().mockResolvedValue(undefined),
        onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(AiService)
      .useValue({
        generateItinerary: jest.fn().mockResolvedValue({
          title: 'Custom Luxury 8-Day Egypt Itinerary',
          durationDays: 8,
          destinations: ['Cairo', 'Luxor', 'Aswan'],
          days: [
            {
              dayNumber: 1,
              location: 'Cairo',
              morning: 'Arrival',
              afternoon: 'Relax',
              evening: 'Dinner',
            },
          ],
        }),
        analyzeCustomer: jest.fn().mockResolvedValue({
          summary:
            'High-net-worth traveler with interest in private Nile cruises.',
          suggestedDestinations: ['Cairo', 'Luxor', 'Aswan'],
          salesStrategy: 'Offer private dahabiya charter with Egyptologist.',
          churnRisk: 'Low',
        }),
        translateHieroglyphics: jest.fn().mockResolvedValue({
          originalName: 'Ahmed',
          hieroglyphicsText: '𓄿𓎛𓅓𓂧',
          transliteration: 'A-H-M-D',
          symbolicMeaning: 'Brave warrior and eternal protector',
        }),
      })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(
      new ResponseTransformInterceptor(app.get(Reflector)),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ─── 1. PUBLIC CHATBOT CONTRACTS ──────────────────────────────────────────

  describe('1. Public Chatbot APIs', () => {
    it('GET /ai/chat/status should return availability status', async () => {
      const res = await request(app.getHttpServer())
        .get('/ai/chat/status')
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('GET /ai/chat/config should return welcome message and suggested questions', async () => {
      const res = await request(app.getHttpServer())
        .get('/ai/chat/config?locale=ar')
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.welcomeMessage).toContain('دوناس ترافيل');
      expect(Array.isArray(res.body.data.suggestedQuestions)).toBe(true);
      expect(res.body.data.isPublicEnabled).toBe(true);
      expect(res.body.data.isInChatBookingEnabled).toBe(false);
    });

    it('GET /ai/chat/personas should return concierge personas in requested locale', async () => {
      const res = await request(app.getHttpServer())
        .get('/ai/chat/personas?locale=ar')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBeDefined();
    });

    it('GET /ai/chat/history should return conversation messages for visitor session', async () => {
      const res = await request(app.getHttpServer())
        .get('/ai/chat/history?sessionId=sess-audit-123')
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.conversationId).toBe('conv-audit-1');
    });

    it('POST /ai/chat/lead should record traveler contact lead', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/chat/lead')
        .send({
          sessionId: 'sess-audit-123',
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          phone: '+15551234567',
        })
        .expect(201);
      expect(res.body.data.success).toBe(true);
    });

    it('POST /ai/chat/handoff should trigger human consultant handoff', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/chat/handoff')
        .send({ sessionId: 'sess-audit-123' })
        .expect(201);
      expect(res.body.data.success).toBe(true);
    });

    it('POST /ai/chat/feedback should record message rating', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/chat/feedback')
        .send({
          conversationId: 'conv-audit-1',
          rating: 1,
          category: 'ACCURATE',
          comments: 'Great assistance',
          locale: 'en',
        })
        .expect(201);
      expect(res.body.data.success).toBe(true);
    });
  });

  // ─── 2. ADMIN AI COMMAND CENTER CONTRACTS ─────────────────────────────────

  describe('2. Admin AI Command Center APIs', () => {
    it('GET /admin/ai/overview should return unified metrics & key pool stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/overview')
        .expect(200);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.metrics.activeProvider).toBe('google');
      expect(res.body.data.metrics.guiderStatus).toBe('ACTIVE');
      expect(res.body.data.metrics.totalConversations).toBeGreaterThanOrEqual(
        0,
      );
      expect(res.body.data.metrics.healthyApiKeysCount).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('GET /admin/ai/analytics should return detailed telemetry & funnel data', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/analytics')
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.providerBreakdown).toBeDefined();
      expect(res.body.data.feedbackSummary).toBeDefined();
    });

    it('GET /admin/ai/config should return masked AI settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/config')
        .expect(200);
      expect(res.body.data.provider).toBe('google');
      expect(res.body.data.model).toBe('gemini-3.6-flash');
      expect(res.body.data.isInChatBookingEnabled).toBe(false);
    });

    it('POST /admin/ai/status should update GuideR availability status', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/ai/status')
        .send({
          status: 'ACTIVE',
          disabledMessage: 'GuideR is online',
        })
        .expect(201);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.enabled).toBe(true);
    });

    it('GET /admin/ai/providers should return full provider registry and routing table', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/providers')
        .expect(200);
      expect(Array.isArray(res.body.data.providers)).toBe(true);
      expect(res.body.data.routingTable).toBeDefined();
      expect(res.body.data.providers.some((p: any) => p.id === 'google')).toBe(
        true,
      );
    });

    it('GET /admin/ai/providers/google/models should return models for google provider', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/providers/google/models')
        .expect(200);
      expect(res.body.data.provider.id).toBe('google');
      expect(Array.isArray(res.body.data.models)).toBe(true);
      expect(res.body.data.models.length).toBeGreaterThan(0);
    });

    it('GET /admin/ai/routing should return current model routing policies', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/routing')
        .expect(200);
      expect(res.body.data.table).toBeDefined();
      expect(res.body.data.agentPolicies).toBeDefined();
    });

    it('GET /admin/ai/keys should return configured key pool with masked keys', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/keys')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].hasKey).toBe(true);
    });

    it('GET /admin/ai/prompts should return versioned prompt history', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/prompts')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /admin/ai/feedback should return paginated message ratings', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/feedback?page=1&limit=10')
        .expect(200);
      expect(res.body.data.page).toBe(1);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /admin/ai/conversations should return paginated conversation logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/conversations?page=1&limit=10')
        .expect(200);
      expect(res.body.data.page).toBe(1);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('GET /admin/ai/agents should return AI agent registry personas', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/agents?locale=ar')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.some((a: any) => a.slug === 'guider')).toBe(true);
    });

    it('GET /admin/ai/models should return full model capability matrix', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/models')
        .expect(200);
      expect(Array.isArray(res.body.data.models)).toBe(true);
      expect(res.body.data.models.length).toBeGreaterThan(0);
    });

    it('POST /admin/ai/simulator/trace should execute diagnostic trace with RAG, prompts, and cost telemetry', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/ai/simulator/trace')
        .send({
          message: 'أريد معرفة برامج النايل كروز الفاخرة في مصر',
          agentSlug: 'guider',
          locale: 'ar',
          enableRag: true,
          enableLiveDb: true,
        })
        .expect(201);

      expect(res.body.data.traceId).toBeDefined();
      expect(res.body.data.answer).toBeDefined();
      expect(res.body.data.answer.length).toBeGreaterThan(10);
      expect(res.body.data.agent).toBeDefined();
      expect(res.body.data.retrieval).toBeDefined();
      expect(res.body.data.prompt).toBeDefined();
      expect(res.body.data.telemetry).toBeDefined();
    });
  });

  // ─── 3. KNOWLEDGE CENTER V5 CONTRACTS ─────────────────────────────────────

  describe('3. Knowledge Center V5 APIs', () => {
    it('GET /admin/ai/knowledge/canonical-entities should return grouped canonical knowledge', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/knowledge/canonical-entities')
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /admin/ai/knowledge/health should return RAG index health & chunk metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/knowledge/health')
        .expect(200);
      expect(res.body.data.status).toBeDefined();
      expect(res.body.data.diagnostics).toBeDefined();
      expect(Array.isArray(res.body.data.byLocale)).toBe(true);
    });

    it('GET /admin/ai/knowledge/status should return sync freshness status', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/knowledge/status')
        .expect(200);
      expect(res.body.data.status).toBeDefined();
    });

    it('GET /admin/ai/knowledge/chunks should return indexed vector/RAG chunks', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ai/knowledge/chunks?page=1&limit=5')
        .expect(200);
      expect(res.body.data.page).toBe(1);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /admin/ai/knowledge/test-retrieval should ground query and retrieve catalog items', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/ai/knowledge/test-retrieval')
        .send({
          query: 'Nile Cruise Luxor Aswan',
          locale: 'en',
          limit: 3,
        })
        .expect(201);
      expect(res.body.data.query).toBe('Nile Cruise Luxor Aswan');
      expect(res.body.data.groundedSummaryText).toBeDefined();
    });
  });

  // ─── 4. SPECIALIZED AI CAPABILITIES ───────────────────────────────────────

  describe('4. Specialized AI Concierge & Tourism Capabilities', () => {
    it('POST /admin/ai/itinerary/generate should return bespoke luxury itinerary', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/ai/itinerary/generate')
        .send({
          destinations: ['Cairo', 'Luxor', 'Aswan'],
          days: 8,
          budgetUsd: 4000,
          pax: 2,
        })
        .expect(201);
      expect(res.body.data.durationDays).toBe(8);
      expect(res.body.data.title).toBeDefined();
    });

    it('POST /admin/ai/customer/:id/analyze should return CRM traveler insights', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/ai/customer/11111111-1111-1111-1111-111111111111/analyze')
        .send({})
        .expect(201);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.churnRisk).toBe('Low');
    });

    it('POST /ai/hieroglyphics should translate name into ancient Egyptian cartouche', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/hieroglyphics')
        .send({ text: 'Ahmed' })
        .expect(201);
      expect(res.body.data.hieroglyphicsText).toBeDefined();
      expect(res.body.data.transliteration).toBeDefined();
    });
  });
});
