import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TourKnowledgeIngestionService } from './services/tour-knowledge-ingestion.service';
import { KnowledgeTranslationService } from './services/knowledge-translation.service';
import { HybridRagEngineService } from './services/hybrid-rag-engine.service';
import { CreateKnowledgeItemDto, UpdateKnowledgeItemDto } from './dto/knowledge.dto';

@ApiTags('Admin - Knowledge Base')
@Controller('admin/ai/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminKnowledgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestionService: TourKnowledgeIngestionService,
    private readonly translationService: KnowledgeTranslationService,
    private readonly hybridRagEngine: HybridRagEngineService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Knowledge Base documents with search & filters' })
  async getKnowledgeItems(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('category') category?: string,
    @Query('locale') locale?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (category) whereClause.category = category;
    if (locale) whereClause.locale = locale;
    if (status) whereClause.status = status;
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.knowledgeBaseItem.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.knowledgeBaseItem.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create new Knowledge Base document' })
  async createKnowledgeItem(@Body() dto: CreateKnowledgeItemDto) {
    const item = await this.prisma.knowledgeBaseItem.create({
      data: {
        title: dto.title,
        content: dto.content,
        locale: dto.locale || 'en',
        category: (dto.category as any) || 'GENERAL',
        tags: dto.tags || [],
        status: (dto.status as any) || 'PUBLISHED',
        source: dto.source || 'ADMIN_PANEL',
        priority: dto.priority ?? 0,
        lastIndexedAt: new Date(),
      },
    });

    return item;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update existing Knowledge Base document' })
  async updateKnowledgeItem(@Param('id') id: string, @Body() dto: UpdateKnowledgeItemDto) {
    const existing = await this.prisma.knowledgeBaseItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Knowledge item not found');
    }

    const updated = await this.prisma.knowledgeBaseItem.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        content: dto.content ?? existing.content,
        locale: dto.locale ?? existing.locale,
        category: (dto.category as any) ?? existing.category,
        tags: dto.tags ?? existing.tags,
        status: (dto.status as any) ?? existing.status,
        source: dto.source ?? existing.source,
        priority: dto.priority ?? existing.priority,
        lastIndexedAt: new Date(),
      },
    });

    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Knowledge Base document' })
  async deleteKnowledgeItem(@Param('id') id: string) {
    const existing = await this.prisma.knowledgeBaseItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Knowledge item not found');
    }

    await this.prisma.knowledgeBaseItem.delete({ where: { id } });
    return { success: true, id };
  }

  @Post('index')
  @ApiOperation({ summary: 'Re-index all published Knowledge Base documents' })
  async reindexKnowledge() {
    const count = await this.prisma.knowledgeBaseItem.updateMany({
      where: { status: 'PUBLISHED' },
      data: { lastIndexedAt: new Date() },
    });

    return { success: true, reindexedCount: count.count, timestamp: new Date().toISOString() };
  }

  @Post('sync-catalog')
  @ApiOperation({ summary: 'Sync active database Tours & Destinations into RAG Knowledge Base' })
  async syncCatalogToKnowledgeBase() {
    const result = await this.ingestionService.syncCatalogToKnowledgeBase();
    return {
      success: true,
      syncedTours: result.syncedTours,
      syncedDestinations: result.syncedDestinations,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('auto-translate')
  @ApiOperation({ summary: 'Auto-generate and translate article into 5 languages (AR, EN, ES, PT, IT) with AI' })
  async autoTranslateKnowledge(
    @Body() body: { title: string; content: string; sourceLocale?: string; category?: string },
  ) {
    if (!body.title || !body.content) {
      throw new NotFoundException('Title and content are required for translation.');
    }
    const translations = await this.translationService.generateFiveLanguageArticle(body);
    return {
      success: true,
      translations,
    };
  }

  @Post('batch-multi-lang')
  @ApiOperation({ summary: 'Save all 5 localized language versions of an article' })
  async saveBatchMultiLang(
    @Body()
    body: {
      articles: Array<{
        title: string;
        content: string;
        locale: string;
        category?: string;
        priority?: number;
        tags?: string[];
      }>;
    },
  ) {
    if (!body.articles || !Array.isArray(body.articles) || body.articles.length === 0) {
      throw new NotFoundException('At least one article version is required.');
    }
    return this.translationService.saveBatchMultiLang(body.articles);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload custom document or text into Knowledge Base' })
  async uploadKnowledgeDocument(
    @Body() body: { title: string; content: string; category?: string; locale?: string; tags?: string[]; priority?: number },
  ) {
    if (!body.title || !body.content) {
      throw new NotFoundException('Title and content are required for document ingestion.');
    }
    const item = await this.prisma.knowledgeBaseItem.create({
      data: {
        title: body.title,
        content: body.content,
        locale: body.locale || 'en',
        category: (body.category as any) || 'GENERAL',
        tags: body.tags || ['custom_upload'],
        status: 'PUBLISHED',
        source: 'ADMIN_UPLOAD',
        sourceType: 'MANUAL',
        isAutoGenerated: false,
        isManuallyOverridden: true,
        priority: body.priority ?? 10,
        lastIndexedAt: new Date(),
      },
    });
    return { success: true, item };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get Knowledge Base and RAG health diagnostics' })
  async getKnowledgeHealth() {
    const [
      totalArticles,
      publishedCount,
      chunksCount,
      byLocale,
      byCategory,
      autoGeneratedCount,
    ] = await Promise.all([
      this.prisma.knowledgeBaseItem.count(),
      this.prisma.knowledgeBaseItem.count({ where: { status: 'PUBLISHED' } }),
      (this.prisma as any).aiKnowledgeChunk.count().catch(() => 0),
      this.prisma.knowledgeBaseItem.groupBy({
        by: ['locale'],
        _count: { id: true },
      }),
      this.prisma.knowledgeBaseItem.groupBy({
        by: ['category'],
        _count: { id: true },
      }),
      this.prisma.knowledgeBaseItem.count({ where: { isAutoGenerated: true } }),
    ]);

    return {
      status: 'HEALTHY',
      totalArticles,
      publishedCount,
      chunksCount,
      autoGeneratedCount,
      byLocale: byLocale.map((l) => ({ locale: l.locale, count: l._count.id })),
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count.id })),
    };
  }

  @Get('chunks')
  @ApiOperation({ summary: 'Inspect indexed multi-lingual chunks with canonical entity IDs' })
  async getIndexedChunks(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('locale') locale?: string,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (locale) where.locale = locale;
    if (entityType) where.entityType = entityType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { canonicalEntityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    try {
      const [items, total] = await Promise.all([
        (this.prisma as any).aiKnowledgeChunk.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { lastIndexedAt: 'desc' },
        }),
        (this.prisma as any).aiKnowledgeChunk.count({ where }),
      ]);

      return {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch {
      // Fallback to knowledgeBaseItem
      const [items, total] = await Promise.all([
        this.prisma.knowledgeBaseItem.findMany({
          where: { locale },
          skip,
          take: limitNum,
          orderBy: { lastIndexedAt: 'desc' },
        }),
        this.prisma.knowledgeBaseItem.count({ where: { locale } }),
      ]);

      return {
        items: items.map((item) => ({
          id: `chunk:${item.id}`,
          canonicalEntityId: `${item.sourceEntityType || 'CUSTOM'}:${item.sourceEntityId || item.id}`,
          entityType: item.sourceEntityType || 'GENERAL',
          locale: item.locale,
          title: item.title,
          content: item.content,
          contentHash: item.contentHash,
          lastIndexedAt: item.lastIndexedAt,
        })),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }
  }

  @Post('test-retrieval')
  @ApiOperation({ summary: 'Test multi-lingual hybrid RAG retrieval against live catalog and knowledge chunks' })
  async testRetrieval(
    @Body()
    body: {
      query: string;
      locale?: string;
      allowedSources?: string[];
      limit?: number;
    },
  ) {
    if (!body.query || !body.query.trim()) {
      throw new NotFoundException('Query is required for retrieval testing.');
    }

    const startTime = Date.now();
    const locale = body.locale || 'en';
    const result = await this.hybridRagEngine.retrieveGroundedKnowledge(
      body.query,
      locale,
      body.allowedSources || ['tours', 'destinations', 'policies', 'hotels', 'transportation'],
      body.limit || 6,
    );

    return {
      query: body.query,
      locale,
      latencyMs: Date.now() - startTime,
      matchedChunksCount: result.matchedChunks.length,
      matchedToursCount: result.groundedTours.length,
      matchedHotelsCount: result.groundedHotels.length,
      matchedTransportationCount: result.groundedTransportation.length,
      matchedChunks: result.matchedChunks,
      groundedTours: result.groundedTours,
      groundedHotels: result.groundedHotels,
      groundedTransportation: result.groundedTransportation,
      groundedSummaryText: result.groundedSummaryText,
    };
  }
}

