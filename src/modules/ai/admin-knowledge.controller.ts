import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { TourKnowledgeIngestionService } from './services/tour-knowledge-ingestion.service';
import {
  KnowledgeTranslationService,
  FiveLanguageTranslationResult,
} from './services/knowledge-translation.service';
import { createHash } from 'crypto';
import { HybridRagEngineService } from './services/hybrid-rag-engine.service';
import {
  CreateKnowledgeItemDto,
  UpdateKnowledgeItemDto,
  CreateMultilingualKnowledgeDto,
  CreateResponseRuleDto,
} from './dto/knowledge.dto';

const SUPPORTED_LOCALES = ['ar', 'en', 'es', 'pt', 'it'];

@ApiTags('Admin - Guider Knowledge Center V5')
@Controller('admin/ai/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminKnowledgeController {
  private readonly logger = new Logger(AdminKnowledgeController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestionService: TourKnowledgeIngestionService,
    private readonly translationService: KnowledgeTranslationService,
    private readonly hybridRagEngine: HybridRagEngineService,
  ) {}

  /**
   * 1. CANONICAL ENTITY GROUPING VIEW (V5 Architecture)
   * Groups localized knowledge items (AR, EN, ES, PT, IT) by their canonical business entity.
   */
  @Get('canonical-entities')
  @ApiOperation({
    summary:
      'Get Knowledge grouped by canonical entities (Tours, Hotels, Policies) with multi-lingual completeness',
  })
  async getCanonicalEntities(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('category') category?: string,
    @Query('entityType') entityType?: string,
    @Query('sourceType') sourceType?: string,
    @Query('aiStatus') aiStatus?: string, // 'ENABLED' | 'DISABLED'
    @Query('syncStatus') syncStatus?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const whereClause: any = {};
    if (category && category !== 'ALL') {
      const cat = category.toUpperCase();
      if (cat === 'POLICIES') {
        whereClause.category = {
          in: [
            'BOOKING_POLICY',
            'CANCELLATION_POLICY',
            'PAYMENT_INFO',
            'VISA_GUIDANCE',
            'SAFETY_ADVICE',
          ],
        };
      } else if (cat === 'FAQS' || cat === 'FAQ') {
        whereClause.category = 'FAQ';
      } else {
        whereClause.category = cat;
      }
    }
    if (entityType && entityType !== 'ALL') {
      whereClause.sourceEntityType = entityType.toUpperCase();
    }
    if (sourceType && sourceType !== 'ALL') {
      whereClause.sourceType = sourceType.toUpperCase();
    }
    if (aiStatus && aiStatus !== 'ALL') {
      whereClause.isExcludedFromAi = aiStatus === 'DISABLED';
    }
    if (syncStatus && syncStatus !== 'ALL') {
      whereClause.syncStatus = syncStatus;
    }
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      whereClause.OR = [
        { title: { contains: cleanSearch, mode: 'insensitive' } },
        { content: { contains: cleanSearch, mode: 'insensitive' } },
        { sourceEntityId: { contains: cleanSearch, mode: 'insensitive' } },
      ];
    }

    const allMatchingItems = await this.prisma.knowledgeBaseItem.findMany({
      where: whereClause,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });

    // Group items by canonical identifier: sourceEntityType:sourceEntityId or fallback to title
    const groupedMap = new Map<string, any>();

    for (const item of allMatchingItems) {
      let baseEntityId = item.sourceEntityId || item.id;
      if (item.locale && baseEntityId.endsWith(`:${item.locale}`)) {
        baseEntityId = baseEntityId.slice(0, -(item.locale.length + 1));
      }

      let canonicalKey = item.sourceEntityId
        ? `${item.sourceEntityType || 'MANUAL'}:${baseEntityId}`
        : null;

      if (!canonicalKey && Array.isArray(item.tags)) {
        const entityTag = item.tags.find(
          (t: string) =>
            typeof t === 'string' &&
            (t.startsWith('entity:') || t.startsWith('canonical:')),
        );
        if (entityTag) {
          canonicalKey = `MANUAL:${entityTag.split(':')[1]}`;
        }
      }

      if (!canonicalKey) {
        canonicalKey =
          item.sourceEntityType && item.sourceEntityType !== 'MANUAL'
            ? `${item.sourceEntityType}:${baseEntityId}`
            : `MANUAL:${baseEntityId}`;
      }

      if (!groupedMap.has(canonicalKey)) {
        const isSourceManaged =
          item.sourceType === 'SYNC_CATALOG' ||
          item.sourceEntityType === 'TOUR' ||
          item.sourceEntityType === 'HOTEL' ||
          item.sourceEntityType === 'TRANSPORTATION';
        groupedMap.set(canonicalKey, {
          canonicalEntityId: canonicalKey,
          sourceEntityType: item.sourceEntityType || 'MANUAL',
          sourceType: isSourceManaged ? 'SOURCE_MANAGED' : 'MANUALLY_MANAGED',
          sourceEntityId: baseEntityId,
          title: item.title,
          category: item.category,
          syncStatus: item.syncStatus || 'SYNCED',
          isExcludedFromAi: item.isExcludedFromAi,
          isRecommendationAllowed: item.isRecommendationAllowed ?? true,
          aiOverrideInstructions: item.aiOverrideInstructions || null,
          aiOverrideContext: item.aiOverrideContext || null,
          adminNotes: item.adminNotes || null,
          isManuallyOverridden: item.isManuallyOverridden,
          validityStart: item.validityStart,
          validityEnd: item.validityEnd,
          updatedAt: item.updatedAt,
          locales: {},
          languages: [],
          languagesCount: 0,
        });
      }

      const entry = groupedMap.get(canonicalKey);
      entry.locales[item.locale] = {
        id: item.id,
        title: item.title,
        content: item.content,
        locale: item.locale,
        status: item.status,
        isExcludedFromAi: item.isExcludedFromAi,
        isManuallyOverridden: item.isManuallyOverridden,
        updatedAt: item.updatedAt,
      };

      // If any language version has override, surface it
      if (item.aiOverrideInstructions && !entry.aiOverrideInstructions) {
        entry.aiOverrideInstructions = item.aiOverrideInstructions;
      }
      if (item.validityEnd && !entry.validityEnd) {
        entry.validityEnd = item.validityEnd;
      }
      if (item.validityStart && !entry.validityStart) {
        entry.validityStart = item.validityStart;
      }
    }

    const canonicalList = Array.from(groupedMap.values()).map((entity) => {
      const languages = SUPPORTED_LOCALES.map((loc) => ({
        locale: loc,
        isComplete: Boolean(entity.locales[loc]),
        id: entity.locales[loc]?.id,
        title: entity.locales[loc]?.title,
        isExcludedFromAi:
          entity.locales[loc]?.isExcludedFromAi ?? entity.isExcludedFromAi,
        status: entity.locales[loc]?.status || 'MISSING',
      }));

      const activeLanguagesCount = languages.filter((l) => l.isComplete).length;

      return {
        ...entity,
        languages,
        languagesCount: activeLanguagesCount,
      };
    });

    const total = canonicalList.length;
    const skip = (pageNum - 1) * limitNum;
    const paginatedItems = canonicalList.slice(skip, skip + limitNum);

    return {
      items: paginatedItems,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * 2. LIST RAW KNOWLEDGE BASE ITEMS
   */
  @Get()
  @ApiOperation({ summary: 'List individual localized Knowledge Base records' })
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
    if (category && category !== 'ALL') {
      const cat = category.toUpperCase();
      if (cat === 'POLICIES') {
        whereClause.category = {
          in: [
            'BOOKING_POLICY',
            'CANCELLATION_POLICY',
            'PAYMENT_INFO',
            'VISA_GUIDANCE',
            'SAFETY_ADVICE',
          ],
        };
      } else if (cat === 'FAQS' || cat === 'FAQ') {
        whereClause.category = 'FAQ';
      } else {
        whereClause.category = cat;
      }
    }
    if (locale && locale !== 'ALL') {
      whereClause.locale = locale.toLowerCase();
    }
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      whereClause.OR = [
        { title: { contains: cleanSearch, mode: 'insensitive' } },
        { content: { contains: cleanSearch, mode: 'insensitive' } },
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
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * 2.1 GET KNOWLEDGE CHUNKS
   */
  @Get('chunks')
  @ApiOperation({ summary: 'Get paginated RAG knowledge chunks' })
  async getChunks(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('locale') locale?: string,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (locale && locale !== 'ALL') where.locale = locale;
    if (entityType && entityType !== 'ALL') where.entityType = entityType;
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { content: { contains: search.trim(), mode: 'insensitive' } },
        { canonicalEntityId: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

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
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * 2.2 REINDEX ALL KNOWLEDGE
   */
  @Post('index')
  @ApiOperation({
    summary:
      'Trigger full reindexing and catalog synchronization for AI Knowledge Base',
  })
  async triggerReindex() {
    const result = await this.ingestionService.syncCatalogToKnowledgeBase();
    return {
      success: true,
      reindexedCount:
        result.syncedTours +
        result.syncedDestinations +
        (result.syncedServices || 0),
      syncedTours: result.syncedTours,
      syncedDestinations: result.syncedDestinations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 2.3 UPLOAD KNOWLEDGE DOCUMENT
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload markdown/text document directly into Knowledge Base',
  })
  async uploadKnowledgeDocument(
    @Body()
    body: {
      title: string;
      content: string;
      locale?: string;
      category?: string;
      tags?: string[];
    },
  ) {
    if (!body.title || !body.content) {
      throw new BadRequestException(
        'Title and content are required for knowledge upload.',
      );
    }

    const item = await this.prisma.knowledgeBaseItem.create({
      data: {
        title: body.title.trim(),
        content: body.content.trim(),
        locale: body.locale || 'en',
        category: (body.category as any) || 'CUSTOM',
        status: 'PUBLISHED',
        tags: body.tags || ['upload', 'manual'],
        isAutoGenerated: false,
      },
    });

    return {
      success: true,
      item,
    };
  }

  /**
   * 4. CREATE NEW KNOWLEDGE ITEM
   */
  @Post()
  @ApiOperation({ summary: 'Create new Knowledge Base document' })
  async createKnowledgeItem(
    @Body() dto: CreateKnowledgeItemDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const contentHash = createHash('sha256').update(dto.content).digest('hex');

    const item = await this.prisma.knowledgeBaseItem.create({
      data: {
        title: dto.title,
        content: dto.content,
        locale: dto.locale || 'en',
        category: (dto.category as any) || 'GENERAL',
        tags: dto.tags || [],
        status: (dto.status as any) || 'PUBLISHED',
        source: dto.source || 'ADMIN_PANEL',
        sourceType:
          dto.sourceEntityType && dto.sourceEntityType !== 'MANUAL'
            ? 'SOURCE_MANAGED'
            : 'MANUALLY_MANAGED',
        sourceEntityType: dto.sourceEntityType || 'MANUAL',
        sourceEntityId: dto.sourceEntityId || undefined,
        contentHash,
        priority: dto.priority ?? 0,
        lastIndexedAt: new Date(),
      },
    });

    // Create initial version snapshot
    await this.prisma.aiKnowledgeVersion
      .create({
        data: {
          knowledgeItemId: item.id,
          versionNumber: 1,
          title: item.title,
          content: item.content,
          locale: item.locale,
          changeSummary: 'Initial document creation',
          changedBy: user?.email || user?.id || 'admin',
        },
      })
      .catch(() => {});

    // Immediately index into ai_knowledge_chunks so GuideR and Testing Lab can retrieve it
    try {
      const canonicalId = item.sourceEntityId
        ? `${item.sourceEntityType || 'MANUAL'}:${item.sourceEntityId}`
        : `MANUAL:${item.id}`;

      await (this.prisma as any).aiKnowledgeChunk.upsert({
        where: { id: `chunk:MANUAL:${item.id}:0` },
        create: {
          id: `chunk:MANUAL:${item.id}:0`,
          canonicalEntityId: canonicalId,
          entityType: item.sourceEntityType || 'MANUAL',
          entityId: item.id,
          locale: item.locale,
          chunkIndex: 0,
          title: item.title,
          content: item.content,
          contentHash,
          metadataJsonb: {
            category: item.category,
            priority: item.priority,
            tags: item.tags,
          },
          lastIndexedAt: new Date(),
        },
        update: {
          title: item.title,
          content: item.content,
          contentHash,
          metadataJsonb: {
            category: item.category,
            priority: item.priority,
            tags: item.tags,
          },
          lastIndexedAt: new Date(),
        },
      });
    } catch {
      // Non-blocking
    }

    return item;
  }

  /**
   * 4.1 CREATE MULTILINGUAL KNOWLEDGE (1-Click 5-Language Ingestion & Chunking)
   */
  @Post('multilingual')
  @ApiOperation({
    summary:
      'Create manual knowledge with automatic 5-language localization and instant chunking',
  })
  async createMultilingualKnowledge(
    @Body() dto: CreateMultilingualKnowledgeDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!dto.title || !dto.content) {
      throw new BadRequestException(
        'Title and content are required for knowledge creation.',
      );
    }

    const sourceLocale = dto.sourceLocale || 'ar';
    const sharedEntityId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const category = (dto.category as any) || 'GENERAL';
    const priority = dto.priority ?? 15;
    const baseTags = dto.tags || [
      'custom',
      'admin',
      String(category).toLowerCase(),
    ];

    let translations: Record<string, { title: string; content: string }>;

    if (dto.autoTranslate !== false) {
      try {
        const genRes =
          await this.translationService.generateFiveLanguageArticle({
            title: dto.title,
            content: dto.content,
            sourceLocale,
            category,
          });
        translations = genRes as unknown as Record<
          string,
          { title: string; content: string }
        >;
      } catch (err: any) {
        this.logger.warn(`Auto-translation fallback: ${err.message}`);
        translations = {
          ar: { title: dto.title, content: dto.content },
          en: { title: dto.title, content: dto.content },
          es: { title: dto.title, content: dto.content },
          pt: { title: dto.title, content: dto.content },
          it: { title: dto.title, content: dto.content },
        };
      }
    } else {
      translations = {
        [sourceLocale]: { title: dto.title, content: dto.content },
      };
    }

    const createdItems = [];
    const localesToSave = Object.keys(translations);

    for (const loc of localesToSave) {
      const trans = translations[loc];
      if (!trans?.title || !trans?.content) continue;

      const contentHash = createHash('sha256')
        .update(trans.content)
        .digest('hex');
      const itemTags = [...baseTags, loc];

      const item = await this.prisma.knowledgeBaseItem.create({
        data: {
          title: trans.title,
          content: trans.content,
          locale: loc,
          category,
          tags: itemTags,
          status: 'PUBLISHED',
          source: `MANUAL:${sharedEntityId}:${loc}`,
          sourceType: 'MANUALLY_MANAGED',
          sourceEntityType: 'MANUAL',
          sourceEntityId: sharedEntityId,
          contentHash,
          isAutoGenerated: loc !== sourceLocale,
          isManuallyOverridden: true,
          priority,
          lastIndexedAt: new Date(),
        },
      });

      // Version log
      await this.prisma.aiKnowledgeVersion
        .create({
          data: {
            knowledgeItemId: item.id,
            versionNumber: 1,
            title: trans.title,
            content: trans.content,
            locale: loc,
            changeSummary:
              loc === sourceLocale
                ? 'Initial document creation'
                : 'Automated 5-language AI translation',
            changedBy: user?.email || user?.id || 'admin',
          },
        })
        .catch(() => {});

      // Upsert chunk into ai_knowledge_chunks immediately
      try {
        await (this.prisma as any).aiKnowledgeChunk.upsert({
          where: { id: `chunk:MANUAL:${sharedEntityId}:${loc}:0` },
          create: {
            id: `chunk:MANUAL:${sharedEntityId}:${loc}:0`,
            canonicalEntityId: `MANUAL:${sharedEntityId}`,
            entityType: 'MANUAL',
            entityId: item.id,
            locale: loc,
            chunkIndex: 0,
            title: trans.title,
            content: trans.content,
            contentHash,
            metadataJsonb: {
              category,
              priority,
              tags: itemTags,
            },
            lastIndexedAt: new Date(),
          },
          update: {
            title: trans.title,
            content: trans.content,
            contentHash,
            metadataJsonb: {
              category,
              priority,
              tags: itemTags,
            },
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // Non-blocking
      }

      createdItems.push(item);
    }

    return {
      success: true,
      canonicalEntityId: `MANUAL:${sharedEntityId}`,
      createdCount: createdItems.length,
      items: createdItems,
    };
  }

  /**
   * 5. UPDATE EXISTING KNOWLEDGE ITEM
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update existing Knowledge Base document' })
  async updateKnowledgeItem(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeItemDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const existing = await this.prisma.knowledgeBaseItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Knowledge item not found');
    }

    const nextVersion = (existing.version || 1) + 1;
    const newContent = dto.content ?? existing.content;
    const newTitle = dto.title ?? existing.title;
    const contentHash = createHash('sha256').update(newContent).digest('hex');

    const updated = await this.prisma.knowledgeBaseItem.update({
      where: { id },
      data: {
        title: newTitle,
        content: newContent,
        locale: dto.locale ?? existing.locale,
        category: (dto.category as any) ?? existing.category,
        tags: dto.tags ?? existing.tags,
        status: (dto.status as any) ?? existing.status,
        source: dto.source ?? existing.source,
        sourceEntityType:
          dto.sourceEntityType !== undefined
            ? dto.sourceEntityType
            : existing.sourceEntityType,
        sourceEntityId:
          dto.sourceEntityId !== undefined
            ? dto.sourceEntityId
            : existing.sourceEntityId,
        contentHash,
        priority: dto.priority ?? existing.priority,
        isManuallyOverridden: true,
        version: nextVersion,
        lastIndexedAt: new Date(),
      },
    });

    // Log version
    await this.prisma.aiKnowledgeVersion
      .create({
        data: {
          knowledgeItemId: id,
          versionNumber: nextVersion,
          title: updated.title,
          content: updated.content,
          locale: updated.locale,
          changeSummary: 'Content edited in Knowledge Center',
          changedBy: user?.email || user?.id || 'admin',
        },
      })
      .catch(() => {});

    // Update chunk in ai_knowledge_chunks
    try {
      const canonicalId = updated.sourceEntityId
        ? `${updated.sourceEntityType || 'MANUAL'}:${updated.sourceEntityId}`
        : `MANUAL:${updated.id}`;

      await (this.prisma as any).aiKnowledgeChunk.upsert({
        where: { id: `chunk:MANUAL:${updated.id}:0` },
        create: {
          id: `chunk:MANUAL:${updated.id}:0`,
          canonicalEntityId: canonicalId,
          entityType: updated.sourceEntityType || 'MANUAL',
          entityId: updated.id,
          locale: updated.locale,
          chunkIndex: 0,
          title: updated.title,
          content: updated.content,
          contentHash,
          metadataJsonb: {
            category: updated.category,
            priority: updated.priority,
            tags: updated.tags,
          },
          lastIndexedAt: new Date(),
        },
        update: {
          title: updated.title,
          content: updated.content,
          contentHash,
          metadataJsonb: {
            category: updated.category,
            priority: updated.priority,
            tags: updated.tags,
          },
          lastIndexedAt: new Date(),
        },
      });
    } catch {
      // Non-blocking
    }

    return updated;
  }

  /**
   * 6. ONE-CLICK AI ACTIVATION TOGGLE
   */
  @Patch(':id/toggle-ai')
  @ApiOperation({
    summary: 'One-click toggle AI activation (Enable/Disable for GuideR)',
  })
  async toggleAiActivation(
    @Param('id') id: string,
    @Body() body: { isExcludedFromAi: boolean },
  ) {
    const existing = await this.prisma.knowledgeBaseItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Knowledge item not found');
    }

    const updated = await this.prisma.knowledgeBaseItem.update({
      where: { id },
      data: {
        isExcludedFromAi: body.isExcludedFromAi,
        lastIndexedAt: new Date(),
      },
    });

    return {
      success: true,
      id: updated.id,
      isExcludedFromAi: updated.isExcludedFromAi,
      isEnabledForAi: !updated.isExcludedFromAi,
    };
  }

  private resolveCanonicalWhere(canonicalId: string): any {
    const decoded = decodeURIComponent(canonicalId);
    const firstColon = decoded.indexOf(':');
    let entityType = '';
    let remainder = '';

    if (firstColon !== -1) {
      entityType = decoded.substring(0, firstColon);
      remainder = decoded.substring(firstColon + 1);
    } else {
      remainder = decoded;
    }

    // Strip optional trailing locale suffix (e.g. :en, :ar, :es, :pt, :it) if present
    const baseId = remainder.replace(/:(en|ar|es|pt|it)$/i, '');

    if (entityType === 'MANUAL') {
      return {
        OR: [
          { id: remainder },
          { id: baseId },
          { sourceEntityId: remainder },
          { sourceEntityId: baseId },
        ],
      };
    }

    if (entityType) {
      return {
        OR: [
          { sourceEntityType: entityType, sourceEntityId: remainder },
          { sourceEntityType: entityType, sourceEntityId: baseId },
          {
            sourceEntityType: entityType,
            sourceEntityId: { startsWith: baseId },
          },
          { id: remainder },
          { id: baseId },
          { sourceEntityId: remainder },
          { sourceEntityId: baseId },
          { sourceEntityId: { startsWith: baseId } },
        ],
      };
    }

    return {
      OR: [
        { id: remainder },
        { id: baseId },
        { sourceEntityId: remainder },
        { sourceEntityId: baseId },
      ],
    };
  }

  /**
   * 7. CANONICAL ENTITY AI TOGGLE
   */
  @Post('canonical/:canonicalId/toggle-ai')
  @ApiOperation({
    summary: 'Toggle AI activation for all languages of a canonical entity',
  })
  async toggleCanonicalAiActivation(
    @Param('canonicalId') canonicalId: string,
    @Body() body: { isExcludedFromAi: boolean },
  ) {
    const updateWhere = this.resolveCanonicalWhere(canonicalId);

    const count = await this.prisma.knowledgeBaseItem.updateMany({
      where: updateWhere,
      data: {
        isExcludedFromAi: body.isExcludedFromAi,
        lastIndexedAt: new Date(),
      },
    });

    return {
      success: true,
      canonicalId,
      updatedCount: count.count,
      isExcludedFromAi: body.isExcludedFromAi,
    };
  }

  /**
   * 8. CUSTOMIZE FOR GUIDER (AI OVERRIDE LAYER)
   * Creates or updates GuideR-specific instructions without mutating underlying business database.
   */
  @Put('canonical/:canonicalId/override')
  @ApiOperation({
    summary: 'Create/update AI Knowledge Override for a canonical entity',
  })
  async updateCanonicalAiOverride(
    @Param('canonicalId') canonicalId: string,
    @Body()
    body: {
      aiOverrideInstructions: string;
      aiOverrideContext?: string;
      isRecommendationAllowed?: boolean;
      validityStart?: string;
      validityEnd?: string;
      adminNotes?: string;
    },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const updateWhere = this.resolveCanonicalWhere(canonicalId);

    let items = await this.prisma.knowledgeBaseItem.findMany({
      where: updateWhere,
    });
    if (items.length === 0) {
      // Robust fallback search: try by ID or title match if exact where didn't find records
      const decoded = decodeURIComponent(canonicalId);
      const lastToken = decoded.split(':').pop() || '';
      items = await this.prisma.knowledgeBaseItem.findMany({
        where: {
          OR: [
            { id: decoded },
            { id: lastToken },
            { sourceEntityId: { contains: lastToken, mode: 'insensitive' } },
            { title: { contains: lastToken, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (items.length === 0) {
      throw new NotFoundException(
        `Canonical entity records not found for '${canonicalId}'`,
      );
    }

    const itemIds = items.map((i) => i.id);

    await this.prisma.knowledgeBaseItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        aiOverrideInstructions: body.aiOverrideInstructions?.trim() || null,
        aiOverrideContext: body.aiOverrideContext?.trim() || null,
        isRecommendationAllowed: body.isRecommendationAllowed ?? true,
        validityStart: body.validityStart ? new Date(body.validityStart) : null,
        validityEnd: body.validityEnd ? new Date(body.validityEnd) : null,
        adminNotes: body.adminNotes?.trim() || null,
        isManuallyOverridden: Boolean(body.aiOverrideInstructions?.trim()),
        lastIndexedAt: new Date(),
      },
    });

    // Record auditable version for primary item
    await this.prisma.aiKnowledgeVersion.create({
      data: {
        knowledgeItemId: items[0].id,
        versionNumber: (items[0].version || 1) + 1,
        title: items[0].title,
        content: items[0].content,
        locale: items[0].locale,
        aiOverrideInstructions: body.aiOverrideInstructions?.trim() || null,
        changeSummary: 'GuideR AI override updated',
        changedBy: user?.email || user?.id || 'admin',
      },
    });

    return {
      success: true,
      canonicalId,
      affectedItemsCount: items.length,
      aiOverrideInstructions: body.aiOverrideInstructions,
      isRecommendationAllowed: body.isRecommendationAllowed ?? true,
    };
  }

  /**
   * 9. CLEAR AI OVERRIDE
   */
  @Delete('canonical/:canonicalId/override')
  @ApiOperation({
    summary: 'Clear AI Knowledge Override and restore canonical database facts',
  })
  async clearCanonicalAiOverride(@Param('canonicalId') canonicalId: string) {
    const updateWhere = this.resolveCanonicalWhere(canonicalId);

    await this.prisma.knowledgeBaseItem.updateMany({
      where: updateWhere,
      data: {
        aiOverrideInstructions: null,
        aiOverrideContext: null,
        isManuallyOverridden: false,
        lastIndexedAt: new Date(),
      },
    });

    return {
      success: true,
      canonicalId,
      message: 'GuideR AI override removed. Restored canonical source data.',
    };
  }

  /**
   * 10. ACTIONABLE PROBLEM CENTER
   */
  @Get('problems/summary')
  @ApiOperation({
    summary:
      'Get actionable issues (missing translations, expired overrides, sync errors)',
  })
  async getKnowledgeProblems() {
    const now = new Date();

    const [failedSyncs, expiredOverrides, sourceDeletedItems, allTourItems] =
      await Promise.all([
        this.prisma.knowledgeBaseItem.findMany({
          where: { syncStatus: 'FAILED' },
          take: 10,
        }),
        this.prisma.knowledgeBaseItem.findMany({
          where: {
            validityEnd: { lt: now },
            isManuallyOverridden: true,
          },
          take: 10,
        }),
        this.prisma.knowledgeBaseItem.findMany({
          where: { syncStatus: 'SOURCE_DELETED' },
          take: 10,
        }),
        this.prisma.knowledgeBaseItem.findMany({
          where: { sourceEntityType: 'TOUR' },
          select: { sourceEntityId: true, locale: true, title: true },
        }),
      ]);

    // Check missing translations in tours
    const tourLocaleMap = new Map<string, Set<string>>();
    allTourItems.forEach((item) => {
      if (item.sourceEntityId) {
        if (!tourLocaleMap.has(item.sourceEntityId)) {
          tourLocaleMap.set(item.sourceEntityId, new Set<string>());
        }
        tourLocaleMap.get(item.sourceEntityId)!.add(item.locale);
      }
    });

    let missingTranslationCount = 0;
    tourLocaleMap.forEach((locales) => {
      if (locales.size < 5) missingTranslationCount++;
    });

    const problemsList: Array<{
      id: string;
      type:
        | 'FAILED_SYNC'
        | 'EXPIRED_OVERRIDE'
        | 'MISSING_TRANSLATION'
        | 'SOURCE_DELETED';
      title: string;
      description: string;
      actionText: string;
      actionUrl?: string;
    }> = [];

    failedSyncs.forEach((item) => {
      problemsList.push({
        id: item.id,
        type: 'FAILED_SYNC',
        title: item.title,
        description: `فشلت مزامنة هذا العنصر مع قاعدة البيانات الرئيسية.`,
        actionText: 'إعادة المزامنة',
      });
    });

    expiredOverrides.forEach((item) => {
      problemsList.push({
        id: item.id,
        type: 'EXPIRED_OVERRIDE',
        title: item.title,
        description: `انتهت صلاحية تخصيص GuideR لهذا العنصر في ${item.validityEnd?.toLocaleDateString('ar-EG')}.`,
        actionText: 'تحديث الصلاحية',
      });
    });

    sourceDeletedItems.forEach((item) => {
      problemsList.push({
        id: item.id,
        type: 'SOURCE_DELETED',
        title: item.title,
        description: `تم حذف الرحلة الأصلية من الكتالوج. تم إيقاف التوصية بها لـ GuideR تلقائياً.`,
        actionText: 'أرشفة المعلومة',
      });
    });

    return {
      totalIssues: problemsList.length + missingTranslationCount,
      failedSyncCount: failedSyncs.length,
      expiredOverrideCount: expiredOverrides.length,
      sourceDeletedCount: sourceDeletedItems.length,
      missingTranslationCount,
      problems: problemsList,
    };
  }

  /**
   * 11. BULK ACTIONS (ENABLE, DISABLE, ARCHIVE)
   */
  @Post('bulk-action')
  @ApiOperation({
    summary: 'Execute bulk action on multiple knowledge documents',
  })
  async executeBulkAction(
    @Body()
    body: {
      action: 'ENABLE_AI' | 'DISABLE_AI' | 'ARCHIVE' | 'PUBLISH';
      ids: string[];
    },
  ) {
    if (!body.ids || body.ids.length === 0) {
      throw new BadRequestException('No IDs provided for bulk action.');
    }

    let updateData: any = {};
    if (body.action === 'ENABLE_AI') {
      updateData = { isExcludedFromAi: false, lastIndexedAt: new Date() };
    } else if (body.action === 'DISABLE_AI') {
      updateData = { isExcludedFromAi: true, lastIndexedAt: new Date() };
    } else if (body.action === 'ARCHIVE') {
      updateData = {
        status: 'ARCHIVED',
        isExcludedFromAi: true,
        lastIndexedAt: new Date(),
      };
    } else if (body.action === 'PUBLISH') {
      updateData = { status: 'PUBLISHED', lastIndexedAt: new Date() };
    }

    const res = await this.prisma.knowledgeBaseItem.updateMany({
      where: { id: { in: body.ids } },
      data: updateData,
    });

    return {
      success: true,
      action: body.action,
      affectedCount: res.count,
    };
  }

  /**
   * 12. VERSION HISTORY & RESTORE
   */
  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for a knowledge item' })
  async getKnowledgeVersions(@Param('id') id: string) {
    const versions = await this.prisma.aiKnowledgeVersion.findMany({
      where: { knowledgeItemId: id },
      orderBy: { versionNumber: 'desc' },
      take: 20,
    });
    return versions;
  }

  @Post(':id/restore-version/:versionId')
  @ApiOperation({ summary: 'Restore a previous version snapshot' })
  async restoreKnowledgeVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const version = await this.prisma.aiKnowledgeVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.knowledgeItemId !== id) {
      throw new NotFoundException('Version snapshot not found');
    }

    const item = await this.prisma.knowledgeBaseItem.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Knowledge item not found');

    const nextVer = (item.version || 1) + 1;

    const restored = await this.prisma.knowledgeBaseItem.update({
      where: { id },
      data: {
        title: version.title,
        content: version.content,
        aiOverrideInstructions: version.aiOverrideInstructions,
        version: nextVer,
        lastIndexedAt: new Date(),
      },
    });

    await this.prisma.aiKnowledgeVersion.create({
      data: {
        knowledgeItemId: id,
        versionNumber: nextVer,
        title: restored.title,
        content: restored.content,
        locale: restored.locale,
        aiOverrideInstructions: restored.aiOverrideInstructions,
        changeSummary: `Restored from Version #${version.versionNumber}`,
        changedBy: user?.email || user?.id || 'admin',
      },
    });

    return {
      success: true,
      item: restored,
      message: `Restored Version #${version.versionNumber} successfully.`,
    };
  }

  /**
   * 13. DELETE ITEM (SAFE OVERFLOW ACTION)
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete Knowledge Base document' })
  async deleteKnowledgeItem(@Param('id') id: string) {
    const existing = await this.prisma.knowledgeBaseItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Knowledge item not found');
    }

    await this.prisma.knowledgeBaseItem.delete({ where: { id } });

    // Also remove any corresponding chunks
    try {
      await (this.prisma as any).aiKnowledgeChunk.deleteMany({
        where: {
          OR: [
            { id: `chunk:MANUAL:${id}:0` },
            { id: `chunk:MANUAL:${existing.sourceEntityId || id}:0` },
            { entityId: id },
            { canonicalEntityId: `MANUAL:${existing.sourceEntityId || id}` },
          ],
        },
      });
    } catch {
      // Non-blocking
    }

    return { success: true, id };
  }

  /**
   * 14. KNOWLEDGE FRESHNESS TELEMETRY & SAFE SYNC ENGINE
   */
  @Get('status')
  @ApiOperation({
    summary:
      'Get GuideR Knowledge Freshness, snapshot version, and sync telemetry',
  })
  async getKnowledgeStatus() {
    return this.ingestionService.getKnowledgeSyncStatus();
  }

  @Post('sync')
  @ApiOperation({
    summary:
      'Trigger manual safe synchronization of GuideR Knowledge from live catalog',
  })
  async triggerSafeSync() {
    return this.ingestionService.safeSyncCatalog('MANUAL');
  }

  @Post('sync-catalog')
  @ApiOperation({
    summary:
      'Sync active database Tours & Destinations into Knowledge Base (backward compatible)',
  })
  async syncCatalogToKnowledgeBase() {
    return this.ingestionService.safeSyncCatalog('MANUAL');
  }

  /**
   * 15. AUTO-TRANSLATE (5 LANGUAGES)
   */
  @Post('auto-translate')
  @ApiOperation({
    summary:
      'Auto-generate and translate article into 5 languages (AR, EN, ES, PT, IT) with AI',
  })
  async autoTranslateKnowledge(
    @Body()
    body: {
      title: string;
      content: string;
      sourceLocale?: string;
      category?: string;
    },
  ) {
    if (!body.title || !body.content) {
      throw new NotFoundException(
        'Title and content are required for translation.',
      );
    }
    const translations =
      await this.translationService.generateFiveLanguageArticle(body);
    return {
      success: true,
      translations,
    };
  }

  /**
   * 16. BATCH SAVE MULTI-LANG
   */
  @Post('batch-multi-lang')
  @ApiOperation({
    summary: 'Save all 5 localized language versions of an article',
  })
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
    if (
      !body.articles ||
      !Array.isArray(body.articles) ||
      body.articles.length === 0
    ) {
      throw new NotFoundException('At least one article version is required.');
    }
    return this.translationService.saveBatchMultiLang(body.articles);
  }

  /**
   * 17. HEALTH DIAGNOSTICS
   */
  @Get('health')
  @ApiOperation({ summary: 'Get Knowledge Base and RAG health diagnostics' })
  async getKnowledgeHealth() {
    let dbReachable = false;
    let retrievalFunctional = false;
    let retrievalLatencyMs = 0;
    let lastError: string | null = null;

    let totalArticles = 0;
    let publishedCount = 0;
    let chunksCount = 0;
    let autoGeneratedCount = 0;
    let byLocale: any[] = [];
    let byCategory: any[] = [];

    try {
      const [totalRes, pubRes, chunksRes, locRes, catRes, autoRes] =
        await Promise.all([
          this.prisma.knowledgeBaseItem.count(),
          this.prisma.knowledgeBaseItem.count({
            where: { status: 'PUBLISHED' },
          }),
          (this.prisma as any).aiKnowledgeChunk.count().catch(() => 0),
          (this.prisma.knowledgeBaseItem as any).groupBy
            ? this.prisma.knowledgeBaseItem.groupBy({
                by: ['locale'],
                _count: { id: true },
              })
            : Promise.resolve([]),
          (this.prisma.knowledgeBaseItem as any).groupBy
            ? this.prisma.knowledgeBaseItem.groupBy({
                by: ['category'],
                _count: { id: true },
              })
            : Promise.resolve([]),
          this.prisma.knowledgeBaseItem
            .count({ where: { isAutoGenerated: true } })
            .catch(() => 0),
        ]);

      totalArticles = totalRes;
      publishedCount = pubRes;
      chunksCount = chunksRes;
      byLocale = locRes;
      byCategory = catRes;
      autoGeneratedCount = autoRes;
      dbReachable = true;

      // Test retrieval
      const retStart = Date.now();
      const testRet = await this.hybridRagEngine.retrieveGroundedKnowledge(
        'Egypt',
        'en',
        ['tours', 'policies'],
        1,
      );
      retrievalLatencyMs = Date.now() - retStart;
      retrievalFunctional =
        testRet.matchedChunks.length > 0 || testRet.groundedTours.length > 0;
    } catch (err: any) {
      lastError = err?.message || 'Database error during health check.';
    }

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'UNHEALTHY';
    if (dbReachable && retrievalFunctional && publishedCount > 0) {
      status = 'HEALTHY';
    } else if (dbReachable && publishedCount > 0) {
      status = 'DEGRADED';
    }

    return {
      status,
      diagnostics: {
        databaseReachable: dbReachable,
        retrievalFunctional,
        retrievalLatencyMs,
        lastError,
      },
      totalArticles,
      publishedCount,
      chunksCount,
      autoGeneratedCount,
      byLocale: (byLocale || []).map((l) => ({
        locale: l.locale,
        count: l._count?.id ?? l.count ?? 0,
      })),
      byCategory: (byCategory || []).map((c) => ({
        category: c.category,
        count: c._count?.id ?? c.count ?? 0,
      })),
    };
  }

  /**
   * 18. TEST RETRIEVAL WITH AI OVERRIDES
   */
  @Post('test-retrieval')
  @ApiOperation({
    summary:
      'Test multi-lingual hybrid RAG retrieval against live catalog and knowledge chunks',
  })
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
      body.allowedSources || [
        'tours',
        'destinations',
        'policies',
        'hotels',
        'transportation',
      ],
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

  /**
   * GET ALL DIRECT RESPONSE RULES (Q&A Directives: "لو اتسألت عن X قول Y")
   */
  @Get('response-rules')
  @ApiOperation({
    summary: 'Get all active & inactive GuideR Response Directives (Q&A Rules)',
  })
  async getResponseRules() {
    const items = await this.prisma.knowledgeBaseItem.findMany({
      where: {
        OR: [
          { sourceType: 'RESPONSE_RULE' },
          { sourceEntityType: 'QA_DIRECTIVE' },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const groupedMap = new Map<string, any>();

    for (const item of items) {
      const ruleId = item.sourceEntityId || item.id;
      if (!groupedMap.has(ruleId)) {
        groupedMap.set(ruleId, {
          ruleId,
          triggerQuestion: item.title,
          prescribedAnswer: item.content,
          category: item.category,
          priority: item.priority || 40,
          isExcludedFromAi: item.isExcludedFromAi,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          languages: {},
        });
      }

      const rule = groupedMap.get(ruleId);
      rule.languages[item.locale] = {
        id: item.id,
        locale: item.locale,
        triggerQuestion: item.title,
        prescribedAnswer: item.content,
        isExcludedFromAi: item.isExcludedFromAi,
      };

      if (item.locale === 'ar' || !rule.triggerQuestion) {
        rule.triggerQuestion = item.title;
        rule.prescribedAnswer = item.content;
      }
    }

    const rulesList = Array.from(groupedMap.values()).map((rule) => {
      const languagesList = SUPPORTED_LOCALES.map((loc) => ({
        locale: loc,
        isComplete: Boolean(rule.languages[loc]),
        id: rule.languages[loc]?.id,
        triggerQuestion: rule.languages[loc]?.triggerQuestion || '',
        prescribedAnswer: rule.languages[loc]?.prescribedAnswer || '',
        isExcludedFromAi:
          rule.languages[loc]?.isExcludedFromAi ?? rule.isExcludedFromAi,
      }));

      return {
        ...rule,
        languagesList,
      };
    });

    return {
      rules: rulesList,
      total: rulesList.length,
    };
  }

  /**
   * CREATE A NEW DIRECT RESPONSE RULE ("لو اتسألت عن X قول Y")
   */
  @Post('response-rules')
  @ApiOperation({
    summary: 'Create a new GuideR Direct Response Rule (Q&A Directive)',
  })
  async createResponseRule(
    @Body() body: CreateResponseRuleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!body.triggerQuestion?.trim() || !body.prescribedAnswer?.trim()) {
      throw new BadRequestException(
        'triggerQuestion and prescribedAnswer are required.',
      );
    }

    const trigger = body.triggerQuestion.trim();
    const answer = body.prescribedAnswer.trim();
    const sourceLoc = (body.sourceLocale || 'ar').toLowerCase();
    const category = (body.category || 'FAQ') as any;
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const shouldTranslate = body.autoTranslate !== false;
    const priority = body.priority || 40;

    let translations: FiveLanguageTranslationResult;

    if (shouldTranslate) {
      try {
        translations =
          await this.translationService.generateFiveLanguageArticle({
            title: trigger,
            content: answer,
            sourceLocale: sourceLoc,
            category,
          });
      } catch (e: any) {
        this.logger.warn(
          `AI Auto-translation failed for response rule: ${e.message}`,
        );
        translations = {
          ar: { title: trigger, content: answer },
          en: { title: trigger, content: answer },
          es: { title: trigger, content: answer },
          pt: { title: trigger, content: answer },
          it: { title: trigger, content: answer },
        };
      }
    } else {
      translations = {
        ar: { title: trigger, content: answer },
        en: { title: trigger, content: answer },
        es: { title: trigger, content: answer },
        pt: { title: trigger, content: answer },
        it: { title: trigger, content: answer },
      };
      translations[sourceLoc as keyof FiveLanguageTranslationResult] = {
        title: trigger,
        content: answer,
      };
    }

    const createdItems: any[] = [];

    for (const loc of SUPPORTED_LOCALES) {
      const locData = translations[
        loc as keyof FiveLanguageTranslationResult
      ] || { title: trigger, content: answer };
      const itemHash = createHash('sha256')
        .update(`${locData.title}:${locData.content}`)
        .digest('hex');

      const created = await this.prisma.knowledgeBaseItem.create({
        data: {
          title: locData.title || trigger,
          content: locData.content || answer,
          locale: loc,
          category,
          tags: ['QA_DIRECTIVE', 'RESPONSE_RULE', 'CUSTOM_QA'],
          status: 'PUBLISHED',
          source: 'ADMIN_DASHBOARD_QA_DIRECTIVE',
          sourceType: 'RESPONSE_RULE',
          sourceEntityType: 'QA_DIRECTIVE',
          sourceEntityId: ruleId,
          contentHash: itemHash,
          isAutoGenerated: loc !== sourceLoc,
          isManuallyOverridden: true,
          isExcludedFromAi: false,
          priority,
          aiOverrideInstructions: `DIRECTIVE RULE: If asked about "${locData.title}", respond strictly with: "${locData.content}"`,
          lastIndexedAt: new Date(),
        },
      });

      // Upsert Chunk for vector/RAG retrieval
      await (this.prisma as any).aiKnowledgeChunk.upsert({
        where: { id: `chunk_${created.id}_0` },
        create: {
          id: `chunk_${created.id}_0`,
          knowledgeItemId: created.id,
          chunkIndex: 0,
          locale: loc,
          content: `[QA DIRECTIVE - IF ASKED ABOUT ${locData.title}] -> ANSWER: ${locData.content}`,
          sourceType: 'RESPONSE_RULE',
          sourceEntityId: ruleId,
          metadataJsonb: {
            title: locData.title,
            category,
            ruleId,
            isDirective: true,
          },
        },
        update: {
          content: `[QA DIRECTIVE - IF ASKED ABOUT ${locData.title}] -> ANSWER: ${locData.content}`,
          locale: loc,
          metadataJsonb: {
            title: locData.title,
            category,
            ruleId,
            isDirective: true,
          },
        },
      });

      createdItems.push(created);
    }

    return {
      success: true,
      ruleId,
      triggerQuestion: trigger,
      prescribedAnswer: answer,
      createdCount: createdItems.length,
      items: createdItems,
    };
  }

  /**
   * TOGGLE DIRECT RESPONSE RULE ACTIVE/INACTIVE (isExcludedFromAi)
   */
  @Patch('response-rules/:ruleId/toggle')
  @ApiOperation({ summary: 'Toggle response rule active/inactive state' })
  async toggleResponseRule(
    @Param('ruleId') ruleId: string,
    @Body() body: { isExcludedFromAi: boolean },
  ) {
    const isExcluded = Boolean(body.isExcludedFromAi);

    const items = await this.prisma.knowledgeBaseItem.findMany({
      where: {
        OR: [{ sourceEntityId: ruleId }, { id: ruleId }],
      },
    });

    if (items.length === 0) {
      throw new NotFoundException(`Response rule '${ruleId}' not found.`);
    }

    const itemIds = items.map((i) => i.id);

    await this.prisma.knowledgeBaseItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        isExcludedFromAi: isExcluded,
        lastIndexedAt: new Date(),
      },
    });

    return {
      success: true,
      ruleId,
      isExcludedFromAi: isExcluded,
      affectedItemsCount: items.length,
    };
  }

  /**
   * DELETE DIRECT RESPONSE RULE
   */
  @Delete('response-rules/:ruleId')
  @ApiOperation({
    summary: 'Delete a direct response rule across all languages',
  })
  async deleteResponseRule(@Param('ruleId') ruleId: string) {
    const items = await this.prisma.knowledgeBaseItem.findMany({
      where: {
        OR: [{ sourceEntityId: ruleId }, { id: ruleId }],
      },
    });

    if (items.length === 0) {
      throw new NotFoundException(`Response rule '${ruleId}' not found.`);
    }

    const itemIds = items.map((i) => i.id);

    await (this.prisma as any).aiKnowledgeChunk.deleteMany({
      where: { knowledgeItemId: { in: itemIds } },
    });

    await this.prisma.knowledgeBaseItem.deleteMany({
      where: { id: { in: itemIds } },
    });

    return {
      success: true,
      ruleId,
      deletedCount: items.length,
    };
  }

  /**
   * GET DETAIL BY ID (placed after static routes like /status, /health, /canonical-entities, /problems/summary)
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get Knowledge Base document by ID' })
  async getKnowledgeItemDetail(@Param('id') id: string) {
    const item = await this.prisma.knowledgeBaseItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('Knowledge item not found');
    }
    return item;
  }
}
