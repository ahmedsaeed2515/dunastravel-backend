import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { HybridRagEngineService } from './services/hybrid-rag-engine.service';
import { TourKnowledgeIngestionService } from './services/tour-knowledge-ingestion.service';
import { LiveCatalogRetrieverService } from './services/live-catalog-retriever.service';

describe('Guider Knowledge Center V5 — Multilingual RAG & Governance Test Suite', () => {
  let hybridRagEngine: HybridRagEngineService;
  let mockPrisma: any;
  let mockLiveCatalog: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      knowledgeBaseItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      aiKnowledgeChunk: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn(),
      },
      aiKnowledgeVersion: {
        create: jest.fn().mockResolvedValue({ id: 'v-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      tour: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockLiveCatalog = {
      getLiveToursByIds: jest.fn().mockResolvedValue([
        {
          id: 'tour-siwa-123',
          slug: 'siwa-alexandria-5-days',
          title: 'Siwa Oasis & Alexandria Luxury Tour',
          durationDays: 5,
          basePriceUsd: 1450,
          currency: 'USD',
          publicUrl: '/tours/siwa-alexandria-5-days',
          upcomingAvailabilities: [{ startDate: '2026-10-15', availableSeats: 8 }],
        },
      ]),
      searchLiveTours: jest.fn().mockResolvedValue([]),
      getLiveHotels: jest.fn().mockResolvedValue([]),
      getLiveTransportation: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridRagEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LiveCatalogRetrieverService, useValue: mockLiveCatalog },
      ],
    }).compile();

    hybridRagEngine = module.get<HybridRagEngineService>(HybridRagEngineService);
  });

  describe('1. Critical Data Governance & Source-of-Truth Integrity', () => {
    it('MUST ground live database transactional truth (price, availability, dates) from live DB', async () => {
      mockPrisma.knowledgeBaseItem.findMany.mockResolvedValue([
        {
          id: 'kb-1',
          title: 'Siwa Oasis Tour',
          content: 'Overview of Siwa oasis trip',
          locale: 'en',
          category: 'CUSTOM_TOURS',
          sourceEntityType: 'TOUR',
          sourceEntityId: 'tour-siwa-123',
          isExcludedFromAi: false,
          priority: 15,
        },
      ]);

      const result = await hybridRagEngine.retrieveGroundedKnowledge('Siwa oasis luxury trip', 'en', ['tours']);

      expect(mockLiveCatalog.getLiveToursByIds).toHaveBeenCalledWith(['tour-siwa-123'], 'en');
      expect(result.groundedTours).toHaveLength(1);
      expect(result.groundedTours[0].basePriceUsd).toBe(1450);
      expect(result.groundedSummaryText).toContain('Base Price: $1450 USD');
      expect(result.groundedSummaryText).toContain('Next Departures: 2026-10-15 (8 seats left)');
    });
  });

  describe('2. AI Knowledge Override Layer (Customization for GuideR)', () => {
    it('MUST attach active AI Overrides to the grounded context without mutating business record', async () => {
      mockPrisma.knowledgeBaseItem.findMany
        .mockResolvedValueOnce([
          {
            id: 'kb-1',
            title: 'Siwa Oasis Tour',
            content: 'Overview of Siwa oasis trip',
            locale: 'en',
            category: 'CUSTOM_TOURS',
            sourceEntityType: 'TOUR',
            sourceEntityId: 'tour-siwa-123',
            isExcludedFromAi: false,
            priority: 15,
          },
        ])
        .mockResolvedValueOnce([
          {
            sourceEntityId: 'tour-siwa-123',
            aiOverrideInstructions: 'Emphasize private desert stargazing and suitability for luxury couples.',
            isRecommendationAllowed: true,
          },
        ]);

      const result = await hybridRagEngine.retrieveGroundedKnowledge('Siwa oasis luxury trip', 'en', ['tours']);

      expect(result.groundedSummaryText).toContain(
        '[GUIDER SPECIAL INSTRUCTION FOR THIS TOUR]: Emphasize private desert stargazing and suitability for luxury couples.',
      );
      expect(result.groundedTours[0].basePriceUsd).toBe(1450); // Transactional truth unchanged
    });

    it('MUST flag recommendation restrictions if isRecommendationAllowed is false', async () => {
      mockPrisma.knowledgeBaseItem.findMany
        .mockResolvedValueOnce([
          {
            id: 'kb-1',
            title: 'Siwa Oasis Tour',
            content: 'Overview of Siwa oasis trip',
            locale: 'en',
            category: 'CUSTOM_TOURS',
            sourceEntityType: 'TOUR',
            sourceEntityId: 'tour-siwa-123',
            isExcludedFromAi: false,
            priority: 15,
          },
        ])
        .mockResolvedValueOnce([
          {
            sourceEntityId: 'tour-siwa-123',
            aiOverrideInstructions: 'Sold out for October, only offer November departures if asked.',
            isRecommendationAllowed: false,
          },
        ]);

      const result = await hybridRagEngine.retrieveGroundedKnowledge('Siwa oasis luxury trip', 'en', ['tours']);

      expect(result.groundedSummaryText).toContain(
        'DO NOT proactively recommend',
      );
    });
  });

  describe('3. AI Activation Toggle (Enable / Disable for GuideR)', () => {
    it('MUST strictly exclude knowledge items marked isExcludedFromAi = true from retrieval', async () => {
      mockPrisma.knowledgeBaseItem.findMany.mockResolvedValue([]); // DB returns nothing because where: { isExcludedFromAi: false }

      const result = await hybridRagEngine.retrieveGroundedKnowledge('Siwa oasis luxury trip', 'en', ['tours']);

      expect(mockPrisma.knowledgeBaseItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isExcludedFromAi: false,
          }),
        }),
      );
      expect(result.matchedChunks).toHaveLength(0);
    });
  });

  describe('4. Multilingual 5-Language Retrieval Fallback', () => {
    it('MUST query both target locale and canonical fallbacks (en/ar) during retrieval', async () => {
      mockPrisma.knowledgeBaseItem.findMany.mockResolvedValue([]);

      await hybridRagEngine.retrieveGroundedKnowledge('Viaggio di lusso sul Nilo', 'it', ['tours']);

      expect(mockPrisma.knowledgeBaseItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ locale: 'it' }, { locale: 'en' }, { locale: 'ar' }],
          }),
        }),
      );
    });
  });
});
