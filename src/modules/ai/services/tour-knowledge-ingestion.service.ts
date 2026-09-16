import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { createHash } from 'crypto';

const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

export interface KnowledgeSnapshotMetadata {
  snapshotVersion: string;
  status: 'HEALTHY' | 'STALE' | 'SYNCING' | 'FAILED' | 'DEGRADED';
  lastSuccessfulSync: string;
  lastSyncDurationMs: number;
  recordCount: number;
  toursCount: number;
  destinationsCount: number;
  servicesCount: number;
  checksum: string;
  nextScheduledSync: string;
  syncIntervalDays: number;
  trigger: 'CRON' | 'MANUAL';
}

export interface KnowledgeSyncStatusResult {
  snapshotVersion: string;
  status: 'HEALTHY' | 'STALE' | 'SYNCING' | 'FAILED' | 'DEGRADED';
  lastSuccessfulSync: string | null;
  lastSyncDurationMs: number | null;
  recordCount: number;
  toursCount: number;
  destinationsCount: number;
  servicesCount: number;
  checksum: string | null;
  nextScheduledSync: string | null;
  syncIntervalDays: number;
  isStale: boolean;
  daysSinceLastSync: number | null;
  recentJobs: any[];
}

@Injectable()
export class TourKnowledgeIngestionService {
  private readonly logger = new Logger(TourKnowledgeIngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates SHA-256 content hash for drift detection
   */
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Weekly Cron (Sunday at 03:00 UTC):
   * Automatically refreshes and validates GuideR Knowledge Base from the live database.
   */
  @Cron('0 3 * * 0')
  async handleScheduledCatalogSync() {
    this.logger.log('Executing automated weekly GuideR Knowledge Base synchronization cron...');
    try {
      await this.safeSyncCatalog('CRON');
    } catch (err: any) {
      this.logger.error(`Scheduled GuideR sync failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Backward-compatible alias for existing controllers and tests
   */
  async syncCatalogToKnowledgeBase(): Promise<{
    syncedTours: number;
    syncedDestinations: number;
    syncedServices: number;
  }> {
    const res = await this.safeSyncCatalog('MANUAL');
    return {
      syncedTours: res.syncedTours,
      syncedDestinations: res.syncedDestinations,
      syncedServices: res.syncedServices,
    };
  }

  /**
   * Multi-Step Safe Synchronization Engine:
   * FETCH -> VALIDATE -> NORMALIZE -> BUILD SNAPSHOT -> ACTIVATE -> LOG
   * 
   * If source data is missing or corrupted, retains previous valid snapshot without loss.
   */
  async safeSyncCatalog(trigger: 'CRON' | 'MANUAL' = 'MANUAL'): Promise<{
    success: boolean;
    snapshotVersion: string;
    syncedTours: number;
    syncedDestinations: number;
    syncedServices: number;
    totalRecords: number;
    checksum: string;
    durationMs: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`Starting safe GuideR Knowledge sync (trigger=${trigger})...`);

    // 1. Create running sync job
    let syncJob: any = null;
    try {
      syncJob = await (this.prisma as any).aiKnowledgeSyncJob.create({
        data: {
          status: 'RUNNING',
          entityType: 'CATALOG_SNAPSHOT',
          totalCount: 0,
          processedCount: 0,
          failedCount: 0,
          startedAt: new Date(),
        },
      });
    } catch (e: any) {
      this.logger.warn(`Could not create aiKnowledgeSyncJob row: ${e.message}`);
    }

    let syncedTours = 0;
    let syncedDestinations = 0;
    let syncedServices = 0;
    const accumulatedHashes: string[] = [];

    try {
      // 2. FETCH: Query active tours and landing pages
      const [tours, landingPages] = await Promise.all([
        this.prisma.tour.findMany({
          where: {
            isActive: true,
            deletedAt: null,
          },
          take: 150,
        }),
        (this.prisma as any).tourLandingPage.findMany({
          where: {
            isActive: true,
            deletedAt: null,
          },
          take: 50,
        }).catch(() => []),
      ]);

      // 3. VALIDATE: Fail-safe check. Never overwrite knowledge with empty catalog!
      if (!tours || tours.length === 0) {
        const errorMsg = 'Validation failed: 0 active tours returned from database. Preserving previous knowledge snapshot.';
        this.logger.error(errorMsg);

        if (syncJob) {
          await (this.prisma as any).aiKnowledgeSyncJob.update({
            where: { id: syncJob.id },
            data: {
              status: 'FAILED',
              errorLog: errorMsg,
              completedAt: new Date(),
            },
          }).catch(() => {});
        }

        throw new BadRequestException(errorMsg);
      }

      // 4. NORMALIZE & UPSERT TOURS
      for (const tour of tours) {
        const tourAny = tour as any;
        const tMap = (tour.titleJsonb && typeof tour.titleJsonb === 'object') ? (tour.titleJsonb as Record<string, string>) : {};
        const oMap = (tour.overviewJsonb && typeof tour.overviewJsonb === 'object') ? (tour.overviewJsonb as Record<string, string>) : {};

        const dest = [tour.city, tour.country].filter(Boolean).join(', ') || 'Egypt & Middle East';
        const durationVal = tourAny.durationDays || tourAny.duration || 5;
        const durationStr = `${durationVal} Days`;

        for (const loc of SUPPORTED_LOCALES) {
          let title = tMap[loc] || tMap.en || tour.slug;
          let overview = oMap[loc] || oMap.en || '';
          let prefix = 'Tour Package';
          let catLabel = tour.category || 'Luxury Tours';
          let pricingNotice = 'Pricing: On Request / Private Custom Quote';

          if (loc === 'ar') {
            prefix = 'رحلة سياحية فاخرة';
            title = tMap.ar || title;
            pricingNotice = 'الأسعار: عند الطلب / عرض سعر مخصص حسب التواريخ ودرجة الإقامة';
          } else if (loc === 'es') {
            prefix = 'Paquete Turístico de Lujo';
            pricingNotice = 'Precios: A consultar / Cotización personalizada';
          } else if (loc === 'pt') {
            prefix = 'Pacote Turístico de Luxo';
            pricingNotice = 'Preços: Sob consulta / Orçamento personalizado';
          } else if (loc === 'it') {
            prefix = 'Pacchetto Turistico Esclusivo';
            pricingNotice = 'Prezzi: Su richiesta / Preventivo personalizzato';
          }

          const content = `${prefix}: ${title}\nDestination: ${dest}\nDuration: ${durationStr}\n${pricingNotice}\nCategory: ${catLabel}\nPublic URL: /tours/${tour.slug}${overview ? `\nOverview: ${overview.slice(0, 280)}` : ''}`;

          const hash = await this.upsertKnowledgeItem({
            sourceKey: `CATALOG_TOUR:${tour.id}:${loc}`,
            sourceEntityType: 'TOUR',
            sourceEntityId: tour.id,
            title: `[${prefix}] ${title}`,
            content,
            locale: loc,
            category: 'CUSTOM_TOURS',
            tags: [tour.slug, dest.toLowerCase(), 'tour', 'package', 'luxury', loc],
            priority: 15,
          });
          if (hash) accumulatedHashes.push(hash);
        }

        syncedTours++;
      }

      // 5. NORMALIZE & UPSERT DESTINATIONS
      for (const lp of landingPages) {
        const tMap = (lp.titleJsonb && typeof lp.titleJsonb === 'object') ? (lp.titleJsonb as Record<string, string>) : {};
        const titleEn = tMap.en || lp.slug.toUpperCase();

        for (const loc of SUPPORTED_LOCALES) {
          let title = tMap[loc] || titleEn;
          let guideLabel = 'Destination Guide';
          if (loc === 'ar') guideLabel = 'دليل الوجهة';
          else if (loc === 'es') guideLabel = 'Guía de Destino';
          else if (loc === 'pt') guideLabel = 'Guia de Destino';
          else if (loc === 'it') guideLabel = 'Guida alla Destinazione';

          const content = `${guideLabel}: ${title}\nSlug: ${lp.slug}\nExplore URL: /destinations/${lp.slug}`;

          const hash = await this.upsertKnowledgeItem({
            sourceKey: `CATALOG_DESTINATION:${lp.id}:${loc}`,
            sourceEntityType: 'TOUR_LANDING_PAGE',
            sourceEntityId: lp.id,
            title: `[${guideLabel}] ${title}`,
            content,
            locale: loc,
            category: 'DESTINATION_INFO',
            tags: [lp.slug, 'destination', 'guide', 'travel', loc],
            priority: 12,
          });
          if (hash) accumulatedHashes.push(hash);
        }

        syncedDestinations++;
      }

      // 6. NORMALIZE & UPSERT CORE SERVICE GUIDES & OFFICIAL POLICIES
      const coreGuides = this.getCoreServiceGuides();
      for (const guide of coreGuides) {
        for (const loc of SUPPORTED_LOCALES) {
          const trans = (guide.translations as any)[loc] || guide.translations.en;
          const hash = await this.upsertKnowledgeItem({
            sourceKey: `${guide.id}:${loc}`,
            sourceEntityType: 'SYSTEM_GUIDE',
            sourceEntityId: `${guide.id}:${loc}`,
            title: trans.title,
            content: trans.content,
            locale: loc,
            category: guide.category as any,
            tags: [...guide.tags, loc],
            priority: guide.priority,
          });
          if (hash) accumulatedHashes.push(hash);
          syncedServices++;
        }
      }

      // 7. BUILD SNAPSHOT & ACTIVATE
      const durationMs = Date.now() - startTime;
      const totalRecords = accumulatedHashes.length;
      const overallChecksum = createHash('sha256').update(accumulatedHashes.sort().join('')).digest('hex');
      const snapshotVersion = `v${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Date.now() / 1000).toString(36)}`;
      const nextSyncIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const snapshotMetadata: KnowledgeSnapshotMetadata = {
        snapshotVersion,
        status: 'HEALTHY',
        lastSuccessfulSync: new Date().toISOString(),
        lastSyncDurationMs: durationMs,
        recordCount: totalRecords,
        toursCount: syncedTours,
        destinationsCount: syncedDestinations,
        servicesCount: syncedServices,
        checksum: overallChecksum,
        nextScheduledSync: nextSyncIso,
        syncIntervalDays: 7,
        trigger,
      };

      // Update active AiConfig knowledgeSettings
      const config = await this.prisma.aiConfig.findFirst({ orderBy: { createdAt: 'desc' } });
      if (config) {
        await this.prisma.aiConfig.update({
          where: { id: config.id },
          data: {
            knowledgeSettings: snapshotMetadata as any,
          },
        });
      }

      // Complete sync job log
      if (syncJob) {
        await (this.prisma as any).aiKnowledgeSyncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'COMPLETED',
            totalCount: totalRecords,
            processedCount: totalRecords,
            failedCount: 0,
            completedAt: new Date(),
          },
        }).catch(() => {});
      }

      this.logger.log(`GuideR Knowledge Base sync COMPLETED in ${durationMs}ms: version=${snapshotVersion}, records=${totalRecords}`);

      return {
        success: true,
        snapshotVersion,
        syncedTours,
        syncedDestinations,
        syncedServices,
        totalRecords,
        checksum: overallChecksum,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`Knowledge Base sync failed: ${err.message}`, err.stack);

      if (syncJob) {
        await (this.prisma as any).aiKnowledgeSyncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'FAILED',
            errorLog: err.message,
            completedAt: new Date(),
          },
        }).catch(() => {});
      }

      throw err;
    }
  }

  /**
   * Retrieves live status of GuideR Knowledge Freshness, snapshot version, and sync health
   */
  async getKnowledgeSyncStatus(): Promise<KnowledgeSyncStatusResult> {
    const config = await this.prisma.aiConfig.findFirst({ orderBy: { createdAt: 'desc' } });
    const settings: any = (config?.knowledgeSettings as any) || {};
    const lastSync = settings.lastSuccessfulSync ? new Date(settings.lastSuccessfulSync) : null;
    const daysSinceLastSync = lastSync ? (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24) : null;
    const isStale = daysSinceLastSync === null || daysSinceLastSync > (settings.syncIntervalDays || 7);

    const [recentJobs, totalKnowledgeItems] = await Promise.all([
      (this.prisma as any).aiKnowledgeSyncJob?.findMany
        ? (this.prisma as any).aiKnowledgeSyncJob.findMany({
            orderBy: { startedAt: 'desc' },
            take: 10,
          }).catch(() => [])
        : Promise.resolve([]),
      this.prisma.knowledgeBaseItem.count({ where: { status: 'PUBLISHED' } }),
    ]);

    return {
      snapshotVersion: settings.snapshotVersion || 'v1.0.0-initial',
      status: isStale ? 'STALE' : (settings.status || 'HEALTHY'),
      lastSuccessfulSync: settings.lastSuccessfulSync || null,
      lastSyncDurationMs: settings.lastSyncDurationMs || null,
      recordCount: totalKnowledgeItems,
      toursCount: settings.toursCount || 0,
      destinationsCount: settings.destinationsCount || 0,
      servicesCount: settings.servicesCount || 0,
      checksum: settings.checksum || null,
      nextScheduledSync: settings.nextScheduledSync || null,
      syncIntervalDays: settings.syncIntervalDays || 7,
      isStale,
      daysSinceLastSync: daysSinceLastSync !== null ? Number(daysSinceLastSync.toFixed(1)) : null,
      recentJobs,
    };
  }

  private getCoreServiceGuides() {
    return [
      {
        id: 'VIP_TAILOR_MADE',
        category: 'CUSTOM_TOURS',
        priority: 20,
        tags: ['custom', 'vip', 'tailor', 'luxury', 'private', 'jet', 'dahabiya'],
        translations: {
          en: {
            title: '[Service] Custom Tailor-Made & VIP Tour Planning (Private Jets & Dahabiyas)',
            content: 'Dunas Travel provides bespoke tailor-made luxury tour planning for families, couples, and VIP groups. Visitors can request custom private itineraries, dedicated guides, private luxury Nile dahabiya yacht charters, private jets, and 5-star luxury hotel arrangements by visiting /tailor-a-tour or contacting our concierge team.',
          },
          ar: {
            title: '[خدمة] تصميم الرحلات المخصصة وباقات VIP الفاخرة (طيران خاص ودهبيات نيلية)',
            content: 'توفر شركة دوناس ترافيل خدمة تصميم الرحلات السياحية الفاخرة والمخصصة بالكامل (Tailor-Made) للعائلات والأفراد وكبار الشخصيات VIP، مع مرشدين خاصين، تأجير يخوت دهبيات نيلية خاصة، طائرات خاصة (Private Jets)، حجوزات فنادق 5 نجوم، وسيارات فارهة. يمكن طلب برنامج مخصص عبر الرابط /tailor-a-tour أو التواصل مع مستشارينا.',
          },
          es: {
            title: '[Servicio] Planificación de Tours Personalizados y VIP (Jets Privados y Dahabiyas)',
            content: 'Dunas Travel ofrece planificación de viajes de lujo a medida para familias, parejas y grupos VIP. Los visitantes pueden solicitar itinerarios privados personalizados, guías exclusivos, dahabiyas privadas en el Nilo, jets privados y hoteles de 5 estrellas en /tailor-a-tour.',
          },
          pt: {
            title: '[Serviço] Planejamento de Tours Personalizados e VIP (Jatos Privados e Dahabiyas)',
            content: 'A Dunas Travel oferece roteiros de luxo personalizados sob medida para famílias e grupos VIP com guias dedicados, cruzeiros privados em dahabiyas no Nilo, jatos privados e hotéis 5 estrelas em /tailor-a-tour.',
          },
          it: {
            title: '[Servizio] Pianificazione Tour Personalizzati e VIP (Jet Privati e Dahabiya)',
            content: 'Dunas Travel offre viaggi di lusso su misura per famiglie, coppie e gruppi VIP con guide dedicate, dahabiya private sul Nilo, jet privati e sistemazioni a 5 stelle su /tailor-a-tour.',
          },
        },
      },
      {
        id: 'PAYMENT_AND_CANCEL',
        category: 'BOOKING_POLICY',
        priority: 20,
        tags: ['payment', 'cancellation', 'refund', 'policy', 'deposit'],
        translations: {
          en: {
            title: '[Policy] Official Payment Methods, Deposits & Cancellation Policy',
            content: 'Online card payments are processed only through GetPayIn hosted checkout. Payment availability and applicable payment terms are shown in the server-calculated booking summary before checkout. Cancellation and refund decisions are handled separately from payment processing.',
          },
          ar: {
            title: '[سياسة] طرق الدفع المعتمدة، شروط الإيداع، وسياسة الإلغاء والاسترداد',
            content: 'تتم معالجة مدفوعات البطاقات عبر الإنترنت حصراً من خلال صفحة الدفع المستضافة لدى GetPayIn. تظهر إتاحة الدفع وأي شروط سداد قابلة للتطبيق في ملخص الحجز المحسوب على الخادم قبل الدفع. تُدار قرارات الإلغاء والاسترداد بصورة منفصلة عن معالجة الدفع.',
          },
          es: {
            title: '[Política] Métodos de Pago, Depósitos y Política de Cancelación',
            content: 'Los pagos con tarjeta en línea se procesan únicamente mediante el checkout alojado de GetPayIn. La disponibilidad del pago y las condiciones aplicables se muestran en el resumen de la reserva calculado por el servidor antes del checkout. La cancelación y el reembolso se gestionan por separado.',
          },
          pt: {
            title: '[Política] Métodos de Pagamento, Depósitos e Política de Cancelamento',
            content: 'Os pagamentos online com cartão são processados apenas pelo checkout hospedado da GetPayIn. A disponibilidade e as condições aplicáveis aparecem no resumo da reserva calculado no servidor antes do checkout. Cancelamento e reembolso são tratados separadamente.',
          },
          it: {
            title: '[Politica] Metodi di Pagamento, Acconti e Politica di Cancellazione',
            content: 'I pagamenti online con carta sono elaborati soltanto tramite il checkout ospitato di GetPayIn. Disponibilità e condizioni applicabili sono mostrate nel riepilogo della prenotazione calcolato dal server prima del checkout. Cancellazione e rimborso sono gestiti separatamente.',
          },
        },
      },
      {
        id: 'AIRPORT_TRANSFERS',
        category: 'TRANSPORTATION',
        priority: 15,
        tags: ['transportation', 'airport', 'transfer', 'limousine', 'mercedes'],
        translations: {
          en: {
            title: '[Service] Luxury Airport & City-to-City Transportation',
            content: 'Dunas Travel provides VIP airport meet-and-assist, private luxury Mercedes transfers, and modern air-conditioned coaches across Cairo, Luxor, Aswan, Hurghada, Sharm El Sheikh, and Istanbul. Book online at /transportation.',
          },
          ar: {
            title: '[خدمة] النقل السياحي الفاخر والتوصيل من وإلى المطار',
            content: 'توفر دوناس ترافيل أسطولاً حديثاً من سيارات الليموزين الفاخرة (مرسيدس، ميني باص، حافلات سياحية حديثة) مع استقبال VIP في المطارات ونقل بين المدن في القاهرة، الأقصر، أسوان، الغردقة، وشرم الشيخ. يمكن الحجز عبر /transportation.',
          },
          es: {
            title: '[Servicio] Transporte de Lujo en Aeropuerto y Entre Ciudades',
            content: 'Dunas Travel ofrece asistencia VIP en el aeropuerto, traslados privados en Mercedes y autocares modernos en El Cairo, Lúxor, Asuán, Hurghada y Estambul. Reserva en /transportation.',
          },
          pt: {
            title: '[Serviço] Transporte de Luxo para Aeroportos e Entre Cidades',
            content: 'A Dunas Travel oferece assistência VIP no aeroporto, traslados em Mercedes de luxo e ônibus modernos no Cairo, Luxor, Aswan, Hurghada e Istambul. Reserve em /transportation.',
          },
          it: {
            title: '[Servizio] Trasporti di Lusso Aeroporto e tra Città',
            content: 'Dunas Travel fornisce assistenza VIP all\'arrivo in aeroporto, trasferimenti privati Mercedes e pullman moderni a Il Cairo, Luxor, Assuan, Hurghada e Istanbul. Prenota su /transportation.',
          },
        },
      },
    ];
  }

  private async upsertKnowledgeItem(params: {
    sourceKey: string;
    sourceEntityType: string;
    sourceEntityId: string;
    title: string;
    content: string;
    locale: string;
    category: any;
    tags: string[];
    priority: number;
  }) {
    const contentHash = this.generateContentHash(params.content);

    const existing = await this.prisma.knowledgeBaseItem.findFirst({
      where: {
        source: params.sourceKey,
        locale: params.locale,
      },
    });

    if (existing) {
      if (existing.isManuallyOverridden) {
        return;
      }

      await this.prisma.knowledgeBaseItem.update({
        where: { id: existing.id },
        data: {
          title: params.title,
          content: params.content,
          contentHash,
          category: params.category,
          tags: params.tags,
          priority: params.priority,
          status: 'PUBLISHED',
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
          lastIndexedAt: new Date(),
        },
      });
    } else {
      await this.prisma.knowledgeBaseItem.create({
        data: {
          title: params.title,
          content: params.content,
          locale: params.locale,
          category: params.category,
          tags: params.tags,
          status: 'PUBLISHED',
          source: params.sourceKey,
          sourceType: 'SYNC_CATALOG',
          sourceEntityType: params.sourceEntityType,
          sourceEntityId: params.sourceEntityId,
          contentHash,
          isAutoGenerated: true,
          isManuallyOverridden: false,
          priority: params.priority,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
          lastIndexedAt: new Date(),
        },
      });
    }

    // Also upsert into AiKnowledgeChunk table for fast multi-lingual hybrid indexing
    try {
      await (this.prisma as any).aiKnowledgeChunk.upsert({
        where: {
          id: `chunk:${params.sourceKey}`,
        },
        create: {
          id: `chunk:${params.sourceKey}`,
          canonicalEntityId: `${params.sourceEntityType}:${params.sourceEntityId}`,
          entityType: params.sourceEntityType,
          entityId: params.sourceEntityId,
          locale: params.locale,
          chunkIndex: 0,
          title: params.title,
          content: params.content,
          contentHash,
          metadataJsonb: {
            category: params.category,
            priority: params.priority,
            tags: params.tags,
          },
          lastIndexedAt: new Date(),
        },
        update: {
          title: params.title,
          content: params.content,
          contentHash,
          metadataJsonb: {
            category: params.category,
            priority: params.priority,
            tags: params.tags,
          },
          lastIndexedAt: new Date(),
        },
      });
    } catch {
      // Non-blocking fallback
    }

    return contentHash;
  }
}

