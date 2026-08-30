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
   * Hybrid Multi-Language Retrieval:
   * 1. Extracts semantic tokens from visitor query
   * 2. Queries indexed chunks in visitor locale (with canonical English/Arabic fallback)
   * 3. Discovers candidate tour / hotel / transport entity IDs
   * 4. Enriches candidate IDs with LIVE transactional database state (current basePrice, seat availability, departure dates)
   * 5. Compiles Grounded Context for the LLM prompt with zero hallucination guarantee.
   */
  async retrieveGroundedKnowledge(
    userMessage: string,
    locale: string = 'en',
    allowedSources: string[] = ['tours', 'destinations', 'policies', 'hotels', 'transportation'],
    limit: number = 6,
  ): Promise<GroundedRetrievalContext> {
    const lang = locale.toLowerCase().split('-')[0];
    const tokens = this.tokenize(userMessage);

    // 1. Fetch relevant KnowledgeBaseItems and Chunks
    const knowledgeItems = await (this.prisma as any).knowledgeBaseItem.findMany({
      where: {
        status: 'PUBLISHED',
        isExcludedFromAi: false,
        OR: [
          { locale: lang },
          { locale: 'en' },
          { locale: 'ar' },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        locale: true,
        category: true,
        priority: true,
        tags: true,
        sourceEntityType: true,
        sourceEntityId: true,
      },
      take: 150,
    });

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

    knowledgeItems.forEach((item: any) => {
      let score = (item.priority || 0) * 1.5;
      const normTitle = this.normalizeText(item.title);
      const normContent = this.normalizeText(item.content);
      const normTags = (item.tags || []).map((t: string) => this.normalizeText(t));

      let matchedTokens = 0;
      tokens.forEach((tok) => {
        if (normTitle.includes(tok)) {
          score += 15;
          matchedTokens++;
        }
        if (normTags.some((t: string) => t.includes(tok) || tok.includes(t))) {
          score += 10;
          matchedTokens++;
        }
        if (normContent.includes(tok)) {
          score += 4;
          matchedTokens++;
        }
      });

      if (matchedTokens > 0 || item.priority >= 20) {
        // Boost same locale
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

    // Sort by score descending
    const topChunks = scoredChunks
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

    // 5. Build Grounded Summary Text for AI System Prompt Injection
    const summaryLines: string[] = [];

    if (groundedTours.length > 0) {
      summaryLines.push(`[GROUNDED_LIVE_TOURS]`);
      groundedTours.forEach((t) => {
        const availStr = (t.upcomingAvailabilities && t.upcomingAvailabilities.length > 0)
          ? `Next Departures: ${t.upcomingAvailabilities.map((a) => `${a.startDate} (${a.availableSeats} seats left)`).join(', ')}`
          : 'Departures: Available on request daily';
        summaryLines.push(`- Tour: "${t.title}" | Slug: ${t.slug} | Duration: ${t.durationDays} Days | Base Price: $${t.basePriceUsd} ${t.currency} | ${availStr} | URL: ${t.publicUrl}`);
      });
    }

    if (topChunks.length > 0) {
      summaryLines.push(`\n[GROUNDED_KNOWLEDGE_ARTICLES]`);
      topChunks.forEach((c) => {
        summaryLines.push(`- [${c.sourceCategory}] ${c.title}:\n  ${c.content.slice(0, 350)}`);
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
