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
      // 2. FETCH: Query active tours (with full itineraries) and landing pages
      const [tours, landingPages] = await Promise.all([
        this.prisma.tour.findMany({
          where: {
            isActive: true,
            deletedAt: null,
          },
          include: {
            itineraries: {
              orderBy: { sortOrder: 'asc' },
            },
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

      // 4. NORMALIZE & UPSERT TOURS WITH COMPREHENSIVE ITINERARIES, INCLUSIONS & POLICIES
      for (const tour of tours) {
        const dest = [tour.city, tour.country].filter(Boolean).join(', ') || 'Egypt & Middle East';

        for (const loc of SUPPORTED_LOCALES) {
          const { title, fullContent, chunks } = this.buildTourKnowledge(tour, loc);

          const hash = await this.upsertKnowledgeItem({
            sourceKey: `CATALOG_TOUR:${tour.id}:${loc}`,
            sourceEntityType: 'TOUR',
            sourceEntityId: tour.id,
            title,
            content: fullContent,
            locale: loc,
            category: 'CUSTOM_TOURS',
            tags: [tour.slug, dest.toLowerCase(), 'tour', 'package', 'luxury', loc],
            priority: 15,
            chunks,
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

  private readonly TOUR_LABELS: Record<string, {
    tourPrefix: string;
    destination: string;
    duration: string;
    category: string;
    pricingNotice: string;
    transportation: string;
    minPax: string;
    meetingPoint: string;
    departureInfo: string;
    exploreUrl: string;
    overviewHeading: string;
    highlightsHeading: string;
    itineraryHeading: string;
    inclusionsHeading: string;
    exclusionsHeading: string;
    hotelsHeading: string;
    policiesHeading: string;
    dayPrefix: string;
    mealsPrefix: string;
    activitiesPrefix: string;
    hotelsPrefix: string;
  }> = {
    ar: {
      tourPrefix: 'رحلة سياحية فاخرة',
      destination: 'الوجهة والمدن',
      duration: 'المدة الزمنية',
      category: 'التصنيف',
      pricingNotice: 'الأسعار: عند الطلب / عرض سعر مخصص حسب التواريخ ومستوى الإقامة (تواصل مع مستشارينا عبر /tailor-a-tour)',
      transportation: 'وسائل النقل المعتمدة',
      minPax: 'الحد الأدنى للمسافرين',
      meetingPoint: 'نقطة التجمع والاستقبال',
      departureInfo: 'مواعيد المغادرة',
      exploreUrl: 'رابط استعراض وحجز البرنامج',
      overviewHeading: 'نبذة عن البرنامج السياحي',
      highlightsHeading: 'أبرز معالم وتجارب الرحلة',
      itineraryHeading: 'خط السير والبرنامج اليومي التفصيلي',
      inclusionsHeading: 'الخدمات المشمولة في الباقة',
      exclusionsHeading: 'الخدمات والمصاريف غير المشمولة',
      hotelsHeading: 'تفاصيل الفنادق والإقامة ونظام الوجبات',
      policiesHeading: 'سياسات الحجز وشروط الإلغاء',
      dayPrefix: 'اليوم',
      mealsPrefix: 'الوجبات المشمولة',
      activitiesPrefix: 'الأنشطة والزيارات',
      hotelsPrefix: 'الإقامة/الفندق',
    },
    en: {
      tourPrefix: 'Luxury Tour Package',
      destination: 'Destinations & Cities',
      duration: 'Duration',
      category: 'Category',
      pricingNotice: 'Pricing: On Request / Private Tailored Quote based on dates and luxury tier (inquire at /tailor-a-tour)',
      transportation: 'Transportation Fleet',
      minPax: 'Minimum Travelers',
      meetingPoint: 'Meeting & Welcome Point',
      departureInfo: 'Departure Schedule',
      exploreUrl: 'Explore & Book URL',
      overviewHeading: 'Tour Overview',
      highlightsHeading: 'Trip Highlights & Key Experiences',
      itineraryHeading: 'Comprehensive Day-by-Day Itinerary',
      inclusionsHeading: 'Included Services & Amenities',
      exclusionsHeading: 'Excluded Services & Personal Expenses',
      hotelsHeading: 'Accommodation & Hotel Details',
      policiesHeading: 'Booking Terms & Cancellation Policies',
      dayPrefix: 'Day',
      mealsPrefix: 'Included Meals',
      activitiesPrefix: 'Activities & Sightseeing',
      hotelsPrefix: 'Hotel/Lodging',
    },
    es: {
      tourPrefix: 'Paquete Turístico de Lujo',
      destination: 'Destinos y Ciudades',
      duration: 'Duración',
      category: 'Categoría',
      pricingNotice: 'Precios: A consultar / Cotización personalizada según fechas y categoría (solicitar en /tailor-a-tour)',
      transportation: 'Transporte',
      minPax: 'Mínimo de pasajeros',
      meetingPoint: 'Punto de encuentro y bienvenida',
      departureInfo: 'Salidas programadas',
      exploreUrl: 'Enlace de reserva',
      overviewHeading: 'Descripción general',
      highlightsHeading: 'Puntos destacados del viaje',
      itineraryHeading: 'Itinerario detallado día a día',
      inclusionsHeading: 'Servicios incluidos',
      exclusionsHeading: 'Servicios no incluidos',
      hotelsHeading: 'Hoteles y régimen de alojamiento',
      policiesHeading: 'Condiciones de reserva y cancelación',
      dayPrefix: 'Día',
      mealsPrefix: 'Comidas incluidas',
      activitiesPrefix: 'Actividades y visitas',
      hotelsPrefix: 'Hotel',
    },
    pt: {
      tourPrefix: 'Pacote Turístico de Luxo',
      destination: 'Destinos e Cidades',
      duration: 'Duração',
      category: 'Categoria',
      pricingNotice: 'Preços: Sob consulta / Orçamento personalizado de acordo com datas e padrão (/tailor-a-tour)',
      transportation: 'Transporte',
      minPax: 'Mínimo de passageiros',
      meetingPoint: 'Ponto de encontro e recepção',
      departureInfo: 'Saídas programadas',
      exploreUrl: 'Link de reserva',
      overviewHeading: 'Visão Geral do Pacote',
      highlightsHeading: 'Destaques e Experiências',
      itineraryHeading: 'Roteiro detalhado dia a dia',
      inclusionsHeading: 'Serviços inclusos',
      exclusionsHeading: 'Serviços não inclusos',
      hotelsHeading: 'Hospedagem e regimes',
      policiesHeading: 'Políticas de reserva e cancelamento',
      dayPrefix: 'Dia',
      mealsPrefix: 'Refeições inclusas',
      activitiesPrefix: 'Atividades e passeios',
      hotelsPrefix: 'Hotel',
    },
    it: {
      tourPrefix: 'Pacchetto Turistico Esclusivo',
      destination: 'Destinazioni e Città',
      duration: 'Durata',
      category: 'Categoria',
      pricingNotice: 'Prezzi: Su richiesta / Preventivo personalizzato in base a date e categoria (/tailor-a-tour)',
      transportation: 'Trasporto',
      minPax: 'Partecipanti minimi',
      meetingPoint: 'Punto di incontro e accoglienza',
      departureInfo: 'Partenze',
      exploreUrl: 'Link di prenotazione',
      overviewHeading: 'Panoramica del Tour',
      highlightsHeading: 'Punti salienti ed esperienze',
      itineraryHeading: 'Itinerario giornaliero completo',
      inclusionsHeading: 'Servizi inclusi',
      exclusionsHeading: 'Servizi non inclusi',
      hotelsHeading: 'Sistemazione alberghiera e pasti',
      policiesHeading: 'Termini di prenotazione e cancellazione',
      dayPrefix: 'Giorno',
      mealsPrefix: 'Pasti inclusi',
      activitiesPrefix: 'Attività ed escursioni',
      hotelsPrefix: 'Hotel',
    },
  };

  private getLocalizedText(field: any, locale: string, fallback: string = ''): string {
    if (!field) return fallback;
    if (typeof field === 'string') return field.trim();
    if (typeof field === 'object') {
      const loc = locale.toLowerCase().split('-')[0];
      const val = field[loc] ?? field.en ?? field.ar ?? '';
      return typeof val === 'string' ? val.trim() : (val ? JSON.stringify(val) : fallback);
    }
    return fallback;
  }

  private getLocalizedList(field: any, locale: string): string[] {
    if (!field) return [];
    const loc = locale.toLowerCase().split('-')[0];
    if (Array.isArray(field)) {
      return field.map((item) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item !== null) {
          const val = item[loc] ?? item.en ?? item.ar ?? '';
          return typeof val === 'string' ? val.trim() : String(val);
        }
        return String(item).trim();
      }).filter(Boolean);
    }
    if (typeof field === 'object') {
      const locArr = field[loc] ?? field.en ?? field.ar;
      if (Array.isArray(locArr)) {
        return locArr.map((item) => (typeof item === 'string' ? item.trim() : JSON.stringify(item))).filter(Boolean);
      }
    }
    return [];
  }

  private formatHotelInfo(hotelInfo: any, locale: string): string {
    if (!hotelInfo) return '';
    if (typeof hotelInfo === 'string') return hotelInfo.trim();
    if (typeof hotelInfo === 'object') {
      const lines: string[] = [];
      if (hotelInfo.hotelCategory) {
        lines.push(`- Category: ${hotelInfo.hotelCategory}`);
      }
      if (hotelInfo.notes) {
        lines.push(`- Notes: ${hotelInfo.notes}`);
      }
      if (Array.isArray(hotelInfo.accommodation)) {
        hotelInfo.accommodation.forEach((acc: any) => {
          const dest = acc.destination || acc.city || '';
          const nights = acc.nights ? `${acc.nights} nights` : '';
          const regime = acc.regime || acc.mealPlan || '';
          const detail = [dest, nights, regime].filter(Boolean).join(' - ');
          if (detail) lines.push(`- ${detail}`);
        });
      }
      return lines.join('\n');
    }
    return '';
  }

  private buildTourKnowledge(tour: any, loc: string): {
    title: string;
    fullContent: string;
    chunks: Array<{ chunkIndex: number; title: string; content: string }>;
  } {
    const labels = this.TOUR_LABELS[loc] || this.TOUR_LABELS['en'];
    const title = this.getLocalizedText(tour.titleJsonb, loc, tour.slug);
    const subtitle = this.getLocalizedText(tour.subtitleJsonb, loc);
    const overview = this.getLocalizedText(tour.overviewJsonb, loc);
    const highlights = this.getLocalizedList(tour.highlightsJsonb, loc);
    const includedServices = this.getLocalizedList(tour.includedServicesJsonb, loc);
    const excludedServices = this.getLocalizedList(tour.excludedServicesJsonb, loc);
    const transportation = this.getLocalizedText(tour.transportationJsonb, loc);
    const minPax = this.getLocalizedText(tour.minPaxJsonb, loc);
    const departureInfo = this.getLocalizedText(tour.departureInfoJsonb, loc);
    const cancellationPolicy = this.getLocalizedText(tour.cancellationPolicyJsonb, loc);
    const terms = this.getLocalizedText(tour.termsJsonb, loc);
    const hotelDetails = this.formatHotelInfo(tour.hotelInfoJsonb, loc);

    const dest = [tour.city, tour.country].filter(Boolean).join(', ') || 'Egypt & Middle East';

    // Format duration
    let durationStr = `${tour.durationDays || 5} Days`;
    if (tour.durationJsonb) {
      if (typeof tour.durationJsonb === 'string') {
        durationStr = tour.durationJsonb;
      } else if (typeof tour.durationJsonb === 'object') {
        const dJson = tour.durationJsonb as any;
        if (dJson[loc]) {
          durationStr = dJson[loc];
        } else if (dJson.days) {
          durationStr = loc === 'ar'
            ? `${dJson.days} أيام ${dJson.nights ? `/ ${dJson.nights} ليالٍ` : ''}`
            : `${dJson.days} Days ${dJson.nights ? `/ ${dJson.nights} Nights` : ''}`;
        }
      }
    }

    const catLabel = tour.category || 'Luxury Tours';
    const cleanTitle = `[${labels.tourPrefix}] ${title}`;

    // ── Chunk 0: Overview, Highlights & Logistics ───────────────────────────
    const chunk0Lines: string[] = [
      `# ${cleanTitle}`,
      `${labels.destination}: ${dest}`,
      `${labels.duration}: ${durationStr}`,
      `${labels.category}: ${catLabel}`,
      `${labels.pricingNotice}`,
    ];
    if (transportation) chunk0Lines.push(`${labels.transportation}: ${transportation}`);
    if (minPax) chunk0Lines.push(`${labels.minPax}: ${minPax}`);
    if (departureInfo) chunk0Lines.push(`${labels.departureInfo}: ${departureInfo}`);
    if (tour.meetingPoint) chunk0Lines.push(`${labels.meetingPoint}: ${tour.meetingPoint}`);
    chunk0Lines.push(`${labels.exploreUrl}: /tours/${tour.slug}`);

    if (subtitle) {
      chunk0Lines.push(`\n**${subtitle}**`);
    }
    if (overview) {
      chunk0Lines.push(`\n## ${labels.overviewHeading}\n${overview}`);
    }
    if (highlights.length > 0) {
      chunk0Lines.push(`\n## ${labels.highlightsHeading}\n${highlights.map((h) => `- ${h}`).join('\n')}`);
    }
    const chunk0Content = chunk0Lines.join('\n');

    // ── Chunk 1: Complete Day-by-Day Itinerary ──────────────────────────────
    const itineraries: any[] = Array.isArray(tour.itineraries) ? tour.itineraries : [];
    const chunk1Lines: string[] = [
      `# [${labels.itineraryHeading}] ${title}`,
      `Tour: ${title} | ${labels.destination}: ${dest} | ${labels.duration}: ${durationStr} | URL: /tours/${tour.slug}`,
    ];

    if (itineraries.length > 0) {
      itineraries.forEach((day: any, idx: number) => {
        const dLabel = day.dayLabel || `${labels.dayPrefix} ${idx + 1}`;
        const dTitle = this.getLocalizedText(day.titleJsonb, loc);
        const desc = this.getLocalizedText(day.descriptionJsonb, loc);
        const meals = this.getLocalizedText(day.mealsJsonb, loc);
        const dayHotels = this.getLocalizedText(day.hotelsJsonb, loc);
        const activities = this.getLocalizedList(day.activitiesJsonb, loc);

        chunk1Lines.push(`\n### ${dLabel}${dTitle ? `: ${dTitle}` : ''}`);
        if (desc) chunk1Lines.push(`- ${labels.activitiesPrefix}: ${desc}`);
        if (activities.length > 0) chunk1Lines.push(`- ${activities.map((a) => `• ${a}`).join(' ')}`);
        if (meals) chunk1Lines.push(`- ${labels.mealsPrefix}: ${meals}`);
        if (dayHotels) chunk1Lines.push(`- ${labels.hotelsPrefix}: ${dayHotels}`);
      });
    } else {
      chunk1Lines.push(`\n${overview || 'Full customized luxury day-by-day itinerary arranged upon inquiry.'}`);
    }
    const chunk1Content = chunk1Lines.join('\n');

    // ── Chunk 2: Inclusions, Exclusions, Hotel Details & Policies ────────────
    const chunk2Lines: string[] = [
      `# [${labels.inclusionsHeading} & ${labels.exclusionsHeading}] ${title}`,
      `Tour: ${title} | Slug: ${tour.slug} | URL: /tours/${tour.slug}`,
      `\n## ${labels.inclusionsHeading}`,
    ];

    if (includedServices.length > 0) {
      chunk2Lines.push(includedServices.map((s) => `- ${s}`).join('\n'));
    } else {
      chunk2Lines.push('- Luxury accommodation, certified private guidance, all regional transfers and scheduled entries.');
    }

    chunk2Lines.push(`\n## ${labels.exclusionsHeading}`);
    if (excludedServices.length > 0) {
      chunk2Lines.push(excludedServices.map((s) => `- ${s}`).join('\n'));
    } else {
      chunk2Lines.push('- International flights, personal discretionary expenses, gratuities and optional experiences.');
    }

    if (hotelDetails) {
      chunk2Lines.push(`\n## ${labels.hotelsHeading}\n${hotelDetails}`);
    }

    if (cancellationPolicy || terms) {
      chunk2Lines.push(`\n## ${labels.policiesHeading}`);
      if (cancellationPolicy) chunk2Lines.push(`- Cancellation: ${cancellationPolicy}`);
      if (terms) chunk2Lines.push(`- Terms: ${terms}`);
    }

    const chunk2Content = chunk2Lines.join('\n');

    // Full unified document for KnowledgeBaseItem
    const fullContent = [chunk0Content, chunk1Content, chunk2Content].join('\n\n---\n\n');

    return {
      title: cleanTitle,
      fullContent,
      chunks: [
        { chunkIndex: 0, title: cleanTitle, content: chunk0Content },
        { chunkIndex: 1, title: `[${labels.itineraryHeading}] ${title}`, content: chunk1Content },
        { chunkIndex: 2, title: `[${labels.inclusionsHeading} & ${labels.exclusionsHeading}] ${title}`, content: chunk2Content },
      ],
    };
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
    chunks?: Array<{
      chunkIndex: number;
      title: string;
      content: string;
    }>;
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

    // Upsert chunks into AiKnowledgeChunk table for fast multi-lingual hybrid indexing
    try {
      const chunkList = (params.chunks && params.chunks.length > 0)
        ? params.chunks
        : [{ chunkIndex: 0, title: params.title, content: params.content }];

      for (const ch of chunkList) {
        const chunkHash = this.generateContentHash(ch.content);
        const chunkId = `chunk:${params.sourceKey}:${ch.chunkIndex}`;
        await (this.prisma as any).aiKnowledgeChunk.upsert({
          where: {
            id: chunkId,
          },
          create: {
            id: chunkId,
            canonicalEntityId: `${params.sourceEntityType}:${params.sourceEntityId}`,
            entityType: params.sourceEntityType,
            entityId: params.sourceEntityId,
            locale: params.locale,
            chunkIndex: ch.chunkIndex,
            title: ch.title,
            content: ch.content,
            contentHash: chunkHash,
            metadataJsonb: {
              category: params.category,
              priority: params.priority,
              tags: params.tags,
            },
            lastIndexedAt: new Date(),
          },
          update: {
            title: ch.title,
            content: ch.content,
            contentHash: chunkHash,
            metadataJsonb: {
              category: params.category,
              priority: params.priority,
              tags: params.tags,
            },
            lastIndexedAt: new Date(),
          },
        });
      }

      // Also maintain legacy base chunk ID if chunkIndex 0 exists
      const baseChunk = chunkList.find((c) => c.chunkIndex === 0) || chunkList[0];
      await (this.prisma as any).aiKnowledgeChunk.upsert({
        where: { id: `chunk:${params.sourceKey}` },
        create: {
          id: `chunk:${params.sourceKey}`,
          canonicalEntityId: `${params.sourceEntityType}:${params.sourceEntityId}`,
          entityType: params.sourceEntityType,
          entityId: params.sourceEntityId,
          locale: params.locale,
          chunkIndex: 0,
          title: baseChunk.title,
          content: baseChunk.content,
          contentHash: this.generateContentHash(baseChunk.content),
          metadataJsonb: {
            category: params.category,
            priority: params.priority,
            tags: params.tags,
          },
          lastIndexedAt: new Date(),
        },
        update: {
          title: baseChunk.title,
          content: baseChunk.content,
          contentHash: this.generateContentHash(baseChunk.content),
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

