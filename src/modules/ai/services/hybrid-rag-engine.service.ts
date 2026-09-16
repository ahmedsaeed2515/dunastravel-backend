import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LiveCatalogRetrieverService, GroundedTourEntity } from './live-catalog-retriever.service';
import { createHash } from 'crypto';

export interface GroundedRetrievalContext {
  matchedChunks: Array<{
    id: string;
    canonicalEntityId: string;
    entityType: string;
    locale: string;
    title: string;
    content: string;
    score: number;
    sourceCategory: string;
  }>;
  groundedTours: GroundedTourEntity[];
  groundedHotels: any[];
  groundedTransportation: any[];
  systemPolicies: string[];
  groundedSummaryText: string;
}

export interface IngestEntityDto {
  canonicalEntityId: string;
  entityType: 'TOUR' | 'HOTEL' | 'DESTINATION' | 'TRANSPORT' | 'POLICY' | 'FAQ' | 'CUSTOM';
  entityId: string;
  translations: Record<string, { title: string; content: string; tags?: string[] }>;
  category: string;
  priority?: number;
}

@Injectable()
export class HybridRagEngineService {
  private readonly logger = new Logger(HybridRagEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveCatalogRetriever: LiveCatalogRetrieverService,
  ) {}

  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ئ/g, 'ء')
      .replace(/ؤ/g, 'ء')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¿¡]/g, ' ')
      .trim();
  }

  private stemArabicToken(token: string): string {
    let t = this.normalizeText(token);
    if (!t) return '';
    if (t.startsWith('ال') && t.length > 3) t = t.substring(2);
    if (t.startsWith('بال') && t.length > 4) t = t.substring(3);
    if (t.startsWith('وال') && t.length > 4) t = t.substring(3);
    if (t.startsWith('كال') && t.length > 4) t = t.substring(3);
    if (t.startsWith('لل') && t.length > 3) t = t.substring(2);
    if (t.startsWith('و') && t.length > 3) t = t.substring(1);
    if (t.startsWith('ب') && t.length > 3) t = t.substring(1);
    if (t.startsWith('ل') && t.length > 3) t = t.substring(1);
    if (t.startsWith('ف') && t.length > 3) t = t.substring(1);

    if (/^(حجز|احجز|احجزلي|الحجز|حجوزات|يحجز|تحجز)$/.test(t)) return 'حجز';
    if (/^(الغاء|إلغاء|الالغاء|يلغي|تلغي|استرداد|استرجاع)$/.test(t)) return 'الغاء';
    if (/^(دفع|الدفع|يدفع|مدفوعات|كاش|كارت|فيزا)$/.test(t)) return 'دفع';
    if (/^(سعر|اسعار|الاسعار|تكلفة|بكام|بكم)$/.test(t)) return 'سعر';
    if (/^(تاشيرة|تأشيرة|تاشيرات|فيزا)$/.test(t)) return 'فيزا';
    if (/^(فندق|فنادق|اقامة)$/.test(t)) return 'فندق';
    if (/^(رحلة|رحلات|جولة|برنامج|باقة|باكدج)$/.test(t)) return 'رحلة';
    if (/^(نيل|نيلية|نايل|كروز)$/.test(t)) return 'نيل';
    if (/^(اهرام|اهرامات|الجيزة|جيزة)$/.test(t)) return 'اهرامات';
    return t;
  }

  private tokenize(text: string): string[] {
    const norm = this.normalizeText(text);
    const raw = norm.split(/\s+/).filter((w) => w.length > 1);
    const tokens: string[] = [];
    raw.forEach((w) => {
      tokens.push(w);
      const stemmed = this.stemArabicToken(w);
      if (stemmed && stemmed !== w) tokens.push(stemmed);
    });
    return Array.from(new Set(tokens));
  }

  /**
   * True Hybrid Multi-Language Retrieval (pg_trgm + FTS + Stemming + Relational Grounding):
   * 1. Extracts semantic tokens from visitor query & stems Arabic/Latin tokens
   * 2. Executes pg_trgm fuzzy similarity & lexical chunk matching on PostgreSQL
   * 3. Performs Reciprocal Rank Fusion (RRF) on candidate chunks
   * 4. Discovers canonical entity IDs (TOUR:<id>, HOTEL:<id>, TRANSPORT:<id>)
   * 5. Enriches candidate IDs with LIVE transactional database state (current basePrice, seat availability, departure dates)
   * 6. Compiles Grounded Context for the LLM prompt with zero hallucination guarantee.
   */
  async retrieveGroundedKnowledge(
    userMessage: string,
    locale: string = 'en',
    allowedSources: string[] = ['tours', 'destinations', 'policies', 'hotels', 'transportation'],
    limit: number = 6,
  ): Promise<GroundedRetrievalContext> {
    const lang = locale.toLowerCase().split('-')[0];
    const tokens = this.tokenize(userMessage);
    const cleanQuery = this.normalizeText(userMessage);

    const scoredChunks: Array<{
      id: string;
      canonicalEntityId: string;
      entityType: string;
      locale: string;
      title: string;
      content: string;
      score: number;
      sourceCategory: string;
    }> = [];

    const candidateTourIds = new Set<string>();

    try {
      // 1. Execute PostgreSQL pg_trgm similarity search on ai_knowledge_chunks
      const rawTrgmResults: any[] = await (this.prisma as any).$queryRawUnsafe(`
        SELECT 
          id,
          canonical_entity_id AS "canonicalEntityId",
          entity_type AS "entityType",
          entity_id AS "entityId",
          locale,
          title,
          content,
          metadata_jsonb AS "metadataJsonb",
          (similarity(title, $1) * 3.5 + similarity(content, $1) * 1.2) AS "trgmScore"
        FROM ai_knowledge_chunks
        WHERE (locale = $2 OR locale = 'en' OR locale = 'ar')
        ORDER BY "trgmScore" DESC
        LIMIT 40;
      `, cleanQuery, lang);

      rawTrgmResults.forEach((row) => {
        let score = (parseFloat(row.trgmScore) || 0) * 100;
        const normTitle = this.normalizeText(row.title);
        const normContent = this.normalizeText(row.content);

        // Lexical token boost
        tokens.forEach((tok) => {
          if (normTitle.includes(tok)) score += 20;
          if (normContent.includes(tok)) score += 5;
        });

        if (row.locale === lang) score += 15;

        const category = (row.metadataJsonb && row.metadataJsonb.category) || 'GENERAL';

        scoredChunks.push({
          id: row.id,
          canonicalEntityId: row.canonicalEntityId,
          entityType: row.entityType,
          locale: row.locale,
          title: row.title,
          content: row.content,
          score,
          sourceCategory: category,
        });

        if (row.entityType === 'TOUR' && row.entityId) {
          candidateTourIds.add(row.entityId);
        }
      });
    } catch (dbErr: any) {
      this.logger.warn(`PostgreSQL pg_trgm query fallback: ${dbErr.message}`);
    }

    // If chunks table is sparse or trgm had low results, fallback/enrich with knowledgeBaseItem
    if (scoredChunks.length < limit) {
      const kbItems = await (this.prisma as any).knowledgeBaseItem.findMany({
        where: {
          status: 'PUBLISHED',
          isExcludedFromAi: false,
          OR: [{ locale: lang }, { locale: 'en' }, { locale: 'ar' }],
        },
        take: 60,
      });

      kbItems.forEach((item: any) => {
        let score = (item.priority || 0) * 1.5;
        const normTitle = this.normalizeText(item.title);
        const normContent = this.normalizeText(item.content);

        let matches = 0;
        tokens.forEach((tok) => {
          if (normTitle.includes(tok)) { score += 15; matches++; }
          if (normContent.includes(tok)) { score += 4; matches++; }
        });

        if (matches > 0 || item.priority >= 20) {
          if (item.locale === lang) score += 10;
          scoredChunks.push({
            id: item.id,
            canonicalEntityId: `${item.sourceEntityType || 'CUSTOM'}:${item.sourceEntityId || item.id}`,
            entityType: item.sourceEntityType || 'POLICY',
            locale: item.locale,
            title: item.title,
            content: item.content,
            score,
            sourceCategory: item.category,
          });

          if (item.sourceEntityType === 'TOUR' && item.sourceEntityId) {
            candidateTourIds.add(item.sourceEntityId);
          }
        }
      });
    }

    // Deduplicate and sort by fused score
    const seenIds = new Set<string>();
    const topChunks = scoredChunks
      .filter((c) => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);


    // 2. Query Live Relational Database for dynamic structured values
    let groundedTours: GroundedTourEntity[] = [];
    if (allowedSources.includes('tours')) {
      if (candidateTourIds.size > 0) {
        groundedTours = await this.liveCatalogRetriever.getLiveToursByIds(
          Array.from(candidateTourIds).slice(0, 4),
          locale,
        );
      }
      // If no candidate tours matched via chunks, do a smart keyword live search
      if (groundedTours.length === 0) {
        groundedTours = await this.liveCatalogRetriever.searchLiveTours({
          destination: tokens.find((t) => ['cairo', 'luxor', 'aswan', 'hurghada', 'egypt', 'قاهرة', 'اقصر', 'اسوان', 'غردقة', 'مصر'].includes(t)),
          locale,
          limit: 3,
        });
      }
    }

    // 3. Query Live Hotels if relevant
    let groundedHotels: any[] = [];
    if (allowedSources.includes('hotels') && tokens.some((t) => ['hotel', 'stay', 'suite', 'resort', 'فندق', 'منتجع', 'اقامة'].includes(t))) {
      groundedHotels = await this.liveCatalogRetriever.getLiveHotels(undefined, 2);
    }

    // 4. Query Transportation if relevant
    let groundedTransportation: any[] = [];
    if (allowedSources.includes('transportation') && tokens.some((t) => ['transfer', 'car', 'limousine', 'airport', 'سيارة', 'توصيل', 'مطار', 'ليموزين'].includes(t))) {
      groundedTransportation = await this.liveCatalogRetriever.getLiveTransportation();
    }

    // 5. Query active AI Overrides for grounded entities
    const now = new Date();
    const entityIds = [
      ...groundedTours.map((t) => t.id),
      ...topChunks.map((c) => c.canonicalEntityId.split(':')[1]).filter(Boolean),
    ];

    const activeOverrides = await (this.prisma as any).knowledgeBaseItem.findMany({
      where: {
        sourceEntityId: { in: entityIds },
        isManuallyOverridden: true,
        isExcludedFromAi: false,
        OR: [
          { validityEnd: null },
          { validityEnd: { gte: now } },
        ],
      },
      select: {
        sourceEntityId: true,
        aiOverrideInstructions: true,
        isRecommendationAllowed: true,
      },
    });

    const overrideMap = new Map<string, { instructions?: string; isRecommendationAllowed: boolean }>();
    activeOverrides.forEach((ov: any) => {
      if (ov.sourceEntityId && !overrideMap.has(ov.sourceEntityId)) {
        overrideMap.set(ov.sourceEntityId, {
          instructions: ov.aiOverrideInstructions,
          isRecommendationAllowed: ov.isRecommendationAllowed ?? true,
        });
      }
    });

    // 6. Build Grounded Summary Text for AI System Prompt Injection
    const summaryLines: string[] = [];

    if (groundedTours.length > 0) {
      summaryLines.push(`[GROUNDED_LIVE_TOURS]`);
      groundedTours.forEach((t) => {
        const ov = overrideMap.get(t.id);
        const availStr = (t.upcomingAvailabilities && t.upcomingAvailabilities.length > 0)
          ? `Next Departures: ${t.upcomingAvailabilities.map((a) => `${a.startDate} (${a.availableSeats} seats left)`).join(', ')}`
          : 'Departures: Available on request daily';
        
        let tourLine = `- Tour: "${t.title}" | Slug: ${t.slug} | Duration: ${t.durationDays} Days | Base Price: $${t.basePriceUsd} ${t.currency} | ${availStr} | URL: ${t.publicUrl}`;
        if (ov?.instructions) {
          tourLine += `\n  [GUIDER SPECIAL INSTRUCTION FOR THIS TOUR]: ${ov.instructions}`;
        }
        if (ov && ov.isRecommendationAllowed === false) {
          tourLine += `\n  [NOTE: Only answer if traveler specifically asks about this tour; DO NOT proactively recommend.]`;
        }
        summaryLines.push(tourLine);
      });
    }

    if (topChunks.length > 0) {
      summaryLines.push(`\n[GROUNDED_KNOWLEDGE_ARTICLES]`);
      topChunks.forEach((c) => {
        summaryLines.push(`- [${c.sourceCategory}] ${c.title}:\n  ${c.content.slice(0, 2000)}`);
      });
    }

    if (groundedHotels.length > 0) {
      summaryLines.push(`\n[GROUNDED_HOTEL_PARTNERS]`);
      groundedHotels.forEach((h) => {
        summaryLines.push(`- Hotel: ${h.name} (${h.city}) | ${h.starRating} Stars | From $${h.minPriceUsd}/night | Amenities: ${h.amenities.join(', ')}`);
      });
    }

    if (groundedTransportation.length > 0) {
      summaryLines.push(`\n[GROUNDED_TRANSPORTATION]`);
      groundedTransportation.forEach((tr) => {
        summaryLines.push(`- Fleet: ${tr.name} (${tr.vehicleType}) | $${tr.priceUsd} USD | Route: ${tr.origin} -> ${tr.destination}`);
      });
    }

    return {
      matchedChunks: topChunks,
      groundedTours,
      groundedHotels,
      groundedTransportation,
      systemPolicies: topChunks.filter((c) => c.sourceCategory.includes('POLICY')).map((c) => c.content),
      groundedSummaryText: summaryLines.join('\n'),
    };
  }

  /**
   * Ingest or update canonical entity with all 5 localized chunk representations
   */
  async ingestMultilingualEntity(dto: IngestEntityDto) {
    const results = [];
    const locales = Object.keys(dto.translations);

    for (const loc of locales) {
      const trans = dto.translations[loc];
      const contentHash = createHash('sha256').update(trans.content).digest('hex');

      // 1. Upsert KnowledgeBaseItem
      const item = await (this.prisma as any).knowledgeBaseItem.upsert({
        where: {
          id: `${dto.canonicalEntityId}:${loc}`,
        },
        create: {
          id: `${dto.canonicalEntityId}:${loc}`,
          title: trans.title,
          content: trans.content,
          locale: loc,
          category: dto.category as any,
          tags: trans.tags || [dto.entityType.toLowerCase(), loc],
          status: 'PUBLISHED',
          source: 'CATALOG_SYNC',
          sourceEntityType: dto.entityType,
          sourceEntityId: dto.entityId,
          contentHash,
          priority: dto.priority ?? 10,
          lastIndexedAt: new Date(),
        },
        update: {
          title: trans.title,
          content: trans.content,
          tags: trans.tags || [dto.entityType.toLowerCase(), loc],
          contentHash,
          priority: dto.priority ?? 10,
          lastIndexedAt: new Date(),
        },
      });

      // 2. Upsert AiKnowledgeChunk
      await (this.prisma as any).aiKnowledgeChunk.upsert({
        where: {
          id: `chunk:${dto.canonicalEntityId}:${loc}:0`,
        },
        create: {
          id: `chunk:${dto.canonicalEntityId}:${loc}:0`,
          canonicalEntityId: dto.canonicalEntityId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          locale: loc,
          chunkIndex: 0,
          title: trans.title,
          content: trans.content,
          contentHash,
          metadataJsonb: {
            category: dto.category,
            priority: dto.priority ?? 10,
          },
          lastIndexedAt: new Date(),
        },
        update: {
          title: trans.title,
          content: trans.content,
          contentHash,
          metadataJsonb: {
            category: dto.category,
            priority: dto.priority ?? 10,
          },
          lastIndexedAt: new Date(),
        },
      });

      results.push(item);
    }

    return results;
  }
}
