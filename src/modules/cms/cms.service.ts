import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CmsBlockStatus, Prisma } from '@prisma/client';
import { sanitizeHtmlContent } from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';
import { AuthenticatedUser } from '../../common/types';
import { randomUUID } from 'crypto';
import { CmsLocale, getCmsBlockDefinition, isCmsLocale } from './cms.registry';
import { UpsertCmsBlockDto } from './dto/cms.dto';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getPublicBlock(key: string, lang?: CmsLocale) {
    this.assertValidKey(key);
    const definition = getCmsBlockDefinition(key);
    if (!definition?.public) throw new NotFoundException('CMS block not found');
    const locale = isCmsLocale(lang) ? lang : undefined;
    const cacheKey = `cms:${key}:${locale ?? 'raw'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException('CMS block not found');

    if (block.status !== CmsBlockStatus.PUBLISHED) {
      throw new NotFoundException('CMS block not found');
    }

    // Cache for 30 minutes
    const content = this.localizePublicContent(block.content, locale);
    const response = { ...block, content: content.content, locale: locale ?? null, translationStatus: content.translationStatus };
    await this.cacheManager.set(cacheKey, response, 1800000);
    return response;
  }

  async findAllAdmin(
    pageVal: number = 1,
    limitVal: number = 20,
    search?: string,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.CmsBlockWhereInput = search
      ? { key: { contains: search, mode: 'insensitive' } }
      : {};

    const [total, records] = await Promise.all([
      this.prisma.cmsBlock.count({ where }),
      this.prisma.cmsBlock.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOneAdmin(key: string) {
    this.assertValidKey(key);
    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException('CMS block not found');
    return block;
  }

  async upsertAdmin(key: string, dto: UpsertCmsBlockDto, actor: AuthenticatedUser) {
    this.assertValidKey(key);
    const sanitizedKey = key.trim();
    const content = dto.content;
    const serialized = JSON.stringify(content);
    if (!serialized || Buffer.byteLength(serialized, 'utf8') > 100_000) {
      throw new BadRequestException('CMS content exceeds the size limit');
    }
    const sanitizedContent = this.sanitizeContent(content, 0);

    const block = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cmsBlock.findUnique({ where: { key: sanitizedKey } });
      if (existing && dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
        throw new ConflictException('CMS block has changed; reload before saving');
      }
      const saved = await tx.cmsBlock.upsert({
        where: { key: sanitizedKey },
        create: { key: sanitizedKey, content: sanitizedContent as Prisma.InputJsonValue, status: dto.status ?? CmsBlockStatus.DRAFT, version: 1, lastUpdatedBy: actor?.id || 'system-admin' },
        update: { content: sanitizedContent as Prisma.InputJsonValue, status: dto.status ?? existing!.status, version: { increment: 1 }, lastUpdatedBy: actor?.id || 'system-admin' },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor?.id || 'system-admin',
          actorRole: actor?.role || 'ADMIN',
          action: 'CMS_BLOCK_UPSERTED',
          entityType: 'CMS_BLOCK',
          entityId: sanitizedKey,
          metadata: {
            contentBytes: Buffer.byteLength(serialized, 'utf8'),
            status: saved.status,
            version: saved.version,
          },
        },
      });
      return saved;
    });

    await this.clearPublicCache(sanitizedKey);

    return block;
  }

  async deleteAdmin(key: string, actor: AuthenticatedUser) {
    this.assertValidKey(key);
    const existing = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException('CMS block not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cmsBlock.delete({ where: { key } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'CMS_BLOCK_DELETED',
          entityType: 'CMS_BLOCK',
          entityId: key,
        },
      });
    });
    await this.clearPublicCache(key);

    return { success: true, message: `CMS block '${key}' deleted.` };
  }

  async createCatalogItem(
    key: string,
    item: Record<string, unknown>,
    actor: AuthenticatedUser,
  ) {
    const itemId = randomUUID();
    return this.mutateCatalog(key, itemId, actor, 'create', item);
  }

  async updateCatalogItem(
    key: string,
    itemId: string,
    item: Record<string, unknown>,
    actor: AuthenticatedUser,
  ) {
    return this.mutateCatalog(key, itemId, actor, 'update', item);
  }

  async deleteCatalogItem(
    key: string,
    itemId: string,
    actor: AuthenticatedUser,
  ) {
    await this.mutateCatalog(key, itemId, actor, 'delete');
    return { success: true };
  }

  private async mutateCatalog(
    key: string,
    itemId: string,
    actor: AuthenticatedUser,
    operation: 'create' | 'update' | 'delete',
    item?: Record<string, unknown>,
  ) {
    this.assertManagedCatalogKey(key);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(itemId)) {
      throw new BadRequestException('Invalid catalog item id');
    }

    const sanitizedItem = item
      ? (this.sanitizeContent({ ...item, id: itemId }, 0) as Record<
          string,
          unknown
        >)
      : undefined;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.cmsBlock.findUnique({ where: { key } });
        const catalog = existing?.content;
        if (catalog !== undefined && !Array.isArray(catalog)) {
          throw new BadRequestException('CMS catalog content must be an array');
        }
        const items =
          (catalog as Array<Record<string, unknown>> | undefined) ?? [];
        const index = items.findIndex((entry) => entry?.id === itemId);

        if (operation !== 'create' && index < 0) {
          throw new NotFoundException('Catalog item not found');
        }

        let next: Array<Record<string, unknown>>;
        if (operation === 'create') {
          next = [sanitizedItem!, ...items];
        } else if (operation === 'update') {
          next = items.map((entry, entryIndex) =>
            entryIndex === index
              ? { ...entry, ...sanitizedItem, id: itemId }
              : entry,
          );
        } else {
          next = items.filter((_, entryIndex) => entryIndex !== index);
        }

        const serialized = JSON.stringify(next);
        if (Buffer.byteLength(serialized, 'utf8') > 100_000) {
          throw new BadRequestException('CMS content exceeds the size limit');
        }

        await tx.cmsBlock.upsert({
          where: { key },
          create: {
            key,
            content: next as Prisma.InputJsonValue,
            lastUpdatedBy: actor.id,
          },
          update: {
            content: next as Prisma.InputJsonValue,
            lastUpdatedBy: actor.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: `CMS_CATALOG_ITEM_${operation.toUpperCase()}D`,
            entityType: 'CMS_CATALOG_ITEM',
            entityId: itemId,
            metadata: { key },
          },
        });
        return sanitizedItem;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.clearPublicCache(key);
    return result;
  }

  private assertManagedCatalogKey(key: string): void {
    this.assertValidKey(key);
    if (getCmsBlockDefinition(key)?.kind !== 'catalog') {
      throw new BadRequestException('CMS block is not a managed catalog');
    }
  }

  private assertValidKey(key: string): void {
    if (
      typeof key !== 'string' ||
      !/^[a-z][a-z0-9_.-]{0,99}$/.test(key) ||
      !getCmsBlockDefinition(key)
    ) {
      throw new BadRequestException('Invalid CMS block key');
    }
  }

  private sanitizeContent(value: unknown, depth: number): unknown {
    if (depth > 5) {
      throw new BadRequestException('CMS content is nested too deeply');
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new BadRequestException('CMS content contains an invalid number');
      }
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > 20_000) {
        throw new BadRequestException('CMS text exceeds the size limit');
      }
      return sanitizeHtmlContent(value);
    }
    if (Array.isArray(value)) {
      if (value.length > 100) {
        throw new BadRequestException('CMS array exceeds the item limit');
      }
      return value.map((item) => this.sanitizeContent(item, depth + 1));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > 100) {
        throw new BadRequestException('CMS object exceeds the key limit');
      }
      const result: Record<string, unknown> = {};
      for (const [key, child] of entries) {
        if (
          !/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(key) ||
          ['__proto__', 'prototype', 'constructor'].includes(key)
        ) {
          throw new BadRequestException('CMS content contains an invalid key');
        }
        result[key] = this.sanitizeContent(child, depth + 1);
      }
      return result;
    }
    throw new BadRequestException('CMS content contains an unsupported value');
  }

  private localizePublicContent(content: unknown, locale?: CmsLocale): { content: unknown; translationStatus: 'NOT_LOCALIZED' | 'PRESENT' | 'MISSING' } {
    if (!locale || !content || typeof content !== 'object' || Array.isArray(content)) {
      return { content, translationStatus: 'NOT_LOCALIZED' };
    }
    const object = content as Record<string, unknown>;
    const hasLocaleShape = ['en', 'ar', 'es', 'pt', 'it'].some((candidate) => Object.prototype.hasOwnProperty.call(object, candidate));
    if (!hasLocaleShape) return { content, translationStatus: 'NOT_LOCALIZED' };
    if (!Object.prototype.hasOwnProperty.call(object, locale)) {
      return { content: null, translationStatus: 'MISSING' };
    }
    return { content: object[locale], translationStatus: 'PRESENT' };
  }

  async seedCuratedDefaults(actor?: AuthenticatedUser) {
    const defaults: Record<string, any> = {
      homepage_hero: {
        badge: {
          en: "Exclusive Luxury Journeys",
          ar: "رحلات سياحية فاخرة وحصرية",
          es: "Viajes de Lujo Exclusivos",
          pt: "Viagens de Luxo Exclusivas",
          it: "Viaggi di Lusso Esclusivi",
        },
        title: {
          en: "Discover Egypt, Turkey & Beyond in Unmatched Luxury",
          ar: "اكتشف مصر، وتركيا، وأروع الوجهات بفخامة لا تُضاهى",
          es: "Descubra Egipto, Turquía y más con un Lujo Incomparable",
          pt: "Descubra o Egito, a Turquia e Mais com Luxo Inigualável",
          it: "Scopri l'Egitto, la Turchia e Oltre con un Lusso Incomparabile",
        },
        subtitle: {
          en: "Handcrafted bespoke itineraries, 5-star private VIP transport, and legendary Egyptian & Mediterranean hospitality.",
          ar: "برامج سياحية مصممة خصيصاً، أسطول نقل خاص VIP 5 نجوم، والضيافة المصرية والمتوسطية العريقة.",
          es: "Itinerarios personalizados, transporte VIP privado de 5 estrellas y legendaria hospitalidad.",
          pt: "Roteiros personalizados, transporte VIP privado 5 estrelas e hospitalidade lendária.",
          it: "Itinerari su misura, trasporto VIP privato a 5 stelle e ospitalità leggendaria.",
        },
        ctaText: {
          en: "Explore Luxury Tours",
          ar: "استكشف البرامج الفاخرة",
          es: "Explorar Tours",
          pt: "Explorar Roteiros",
          it: "Esplora Tour",
        },
        ctaLink: "/tours",
        heroImageUrl: "/imgs/hero/pyramids-luxury.jpg",
        stats: {
          experienceYears: 15,
          happyTravelers: 45000,
          satisfactionRate: 99,
          destinationsCount: 12,
        },
      },
      about_page: {
        title: {
          en: "Crafting Legendary Travel Experiences Since 2011",
          ar: "صناعة تجارب السفر الأسطورية الفاخرة منذ عام 2011",
          es: "Creando Experiencias de Viaje Legendarias Desde 2011",
        },
        subtitle: {
          en: "Dunas Travel is a premier destination management company specializing in high-end luxury expeditions across Egypt, Turkey, Jordan, and the Middle East.",
          ar: "ديوناس ترافيل هي الشركة الرائدة في إدارة الوجهات السياحية المتخصصة في الرحلات الفاخرة عبر مصر، تركيا، الأردن، والشرق الأوسط.",
          es: "Dunas Travel es la empresa líder en gestión de destinos de lujo en Egipto, Turquía y Medio Oriente.",
        },
        story: {
          en: "Founded with a vision to redefine luxury travel, we blend deep cultural heritage with bespoke modern comfort. Our dedicated team of destination experts and multilingual guides ensure every moment is extraordinary.",
          ar: "تأسست الشركة برؤية تهدف إلى إعادة تعريف السفر الفاخر من خلال الجمع بين التراث الحضاري العريق والراحة العصرية المطلقة مع فريق من نخبة الخبراء والمرشدين متعددي اللغات.",
          es: "Fundada con la visión de redefinir los viajes de lujo combinando patrimonio cultural y confort moderno.",
        },
        vision: {
          en: "To be the world's most trusted luxury gateway to the historic wonders of the Middle East.",
          ar: "أن نكون البوابة الأكثر موثوقية وفخامة في العالم لاكتشاف عجائب الشرق الأوسط وتاريخه الخالد.",
          es: "Ser la puerta de entrada de lujo más confiable del mundo a las maravillas de Oriente Medio.",
        },
        stats: {
          years: "15+",
          travelers: "45,000+",
          destinations: "12+",
          partners: "350+",
        },
      },
      about: {
        title: {
          en: "Crafting Legendary Travel Experiences Since 2011",
          ar: "صناعة تجارب السفر الأسطورية الفاخرة منذ عام 2011",
        },
        subtitle: {
          en: "Dunas Travel Luxury Expeditions",
          ar: "ديوناس ترافيل للرحلات الفاخرة",
        },
      },
      faq_page: {
        heading: {
          en: "Frequently Asked Questions",
          ar: "الأسئلة الشائعة والأكثر تكراراً",
          es: "Preguntas Frecuentes",
          pt: "Perguntas Frequentes",
          it: "Domande Frequenti",
        },
        helpCenter: {
          en: "DUNAS TRAVEL HELP CENTER",
          ar: "مركز مساعدة ديوناس ترافيل",
          es: "CENTRO DE AYUDA DUNAS TRAVEL",
          pt: "CENTRO DE AJUDA DUNAS TRAVEL",
          it: "CENTRO ASSISTENZA DUNAS TRAVEL",
        },
        items: [
          {
            id: "faq-1",
            category: "bookings",
            question: {
              en: "How do I book a private luxury tour with Dunas Travel?",
              ar: "كيف يمكنني حجز رحلة خاصة فاخرة مع ديوناس ترافيل؟",
              es: "¿Cómo reservo un tour de lujo privado con Dunas Travel?",
            },
            answer: {
              en: "You can easily select your desired tour package on our website, customize dates and travelers, or contact our 24/7 VIP Concierge via WhatsApp for a bespoke private itinerary.",
              ar: "يمكنك اختيار باقتك المفضلة مباشرة عبر موقعنا، أو تخصيص التواريخ وعدد المسافرين، أو التواصل مع كونسيرج VIP المتاح 24/7 عبر الواتساب لتصميم برنامج خاص.",
              es: "Puede seleccionar su paquete en nuestro sitio web o contactar a nuestro Concierge VIP 24/7 por WhatsApp.",
            },
          },
          {
            id: "faq-2",
            category: "transport",
            question: {
              en: "What types of transportation vehicles are provided?",
              ar: "ما هي أنواع مركبات النقل المتوفرة في رحلاتكم؟",
              es: "¿Qué tipo de vehículos de transporte se proporcionan?",
            },
            answer: {
              en: "Our modern fleet includes air-conditioned luxury sedans, VIP Mercedes Sprinters, 26-seat coasters, and 50-passenger executive coaches equipped with Wi-Fi, leather seats, and private chauffeurs.",
              ar: "أسطولنا يضم سيارات سيدان فاخرة، مرسيدس سبرينتر VIP، حافلات كوستر 26 راكب، وأتوبيسات سياحية 50 راكب مجهزة بالواي فاي، مقاعد جلدية، وسائقين محترفين.",
              es: "Nuestra flota incluye sedanes de lujo, Mercedes Sprinter VIP y autobuses ejecutivos con Wi-Fi y chófer privado.",
            },
          },
          {
            id: "faq-3",
            category: "cancellations",
            question: {
              en: "What is the cancellation and refund policy?",
              ar: "ما هي سياسة الإلغاء واسترداد الأموال المتبعة؟",
              es: "¿Cuál es la política de cancelación y reembolso?",
            },
            answer: {
              en: "We offer flexible cancellation terms. Free cancellations are available up to 14 days before departure for standard itineraries with 100% deposit protection.",
              ar: "نوفر شروط إلغاء مرنة للغاية؛ حيث يمكنك الإلغاء مجاناً حتى 14 يوماً قبل موعد بدء الرحلة مع ضمان استرداد الدفعة المقدمة بالكامل.",
              es: "Ofrecemos cancelación gratuita hasta 14 días antes de la salida con reembolso del 100% del depósito.",
            },
          },
        ],
      },
      global_seo: {
        titleSuffix: " | Dunas Travel Luxury Expeditions",
        metaDescription: {
          en: "Discover Egypt, Turkey, and beyond with Dunas Travel. Bespoke luxury tours, 5-star private VIP transport, and unforgettable cultural journeys.",
          ar: "اكتشف مصر وتركيا وأروع الوجهات مع ديوناس ترافيل. برامج سياحية فاخرة، نقل خاص VIP 5 نجوم، وتجارب استثنائية لا تُنسى.",
          es: "Descubra Egipto, Turquía y más con Dunas Travel. Tours de lujo personalizados y transporte VIP 5 estrellas.",
        },
        ogImageUrl: "/imgs/og-dunas-luxury.jpg",
        keywords: "luxury travel, egypt tours, turkey luxury tours, private pyramids tour, nile cruise vip, dunas travel",
        twitterHandle: "@DunasTravel",
      },
      footer_info: {
        copyright: {
          en: "© 2026 Dunas Travel. All rights reserved. Registered Tourism License #1892.",
          ar: "© 2026 ديوناس ترافيل. جميع الحقوق محفوظة. ترخيص وزارة السياحة رقم 1892.",
          es: "© 2026 Dunas Travel. Todos los derechos reservados. Licencia de Turismo #1892.",
        },
        supportEmail: "concierge@dunastravel.com",
        vipWhatsapp: "+20 100 000 0000",
        phone: "+20 2 2700 0000",
        address: {
          en: "Dunas Luxury Tower, El-Nile Corniche, Cairo, Egypt",
          ar: "برج ديوناس الفاخر، كورنيش النيل، القاهرة، مصر",
          es: "Torre Dunas Luxury, Corniche del Nilo, El Cairo, Egipto",
        },
        socialLinks: {
          instagram: "https://instagram.com/dunastravel",
          facebook: "https://facebook.com/dunastravel",
          youtube: "https://youtube.com/@dunastravel",
          tripadvisor: "https://tripadvisor.com/dunastravel",
        },
      },
      contact_info: {
        headquarters: {
          en: "Cairo, Egypt",
          ar: "القاهرة، مصر",
        },
        hotline: "+20 100 000 0000",
        email: "info@dunastravel.com",
      },
    };

    const results: any[] = [];

    for (const [key, content] of Object.entries(defaults)) {
      const sanitizedContent = this.sanitizeContent(content, 0);
      const saved = await this.prisma.cmsBlock.upsert({
        where: { key },
        create: {
          key,
          content: sanitizedContent as Prisma.InputJsonValue,
          status: CmsBlockStatus.PUBLISHED,
          version: 1,
          lastUpdatedBy: actor?.id || 'system-seed',
        },
        update: {
          content: sanitizedContent as Prisma.InputJsonValue,
          status: CmsBlockStatus.PUBLISHED,
          version: { increment: 1 },
          lastUpdatedBy: actor?.id || 'system-seed',
        },
      });
      await this.clearPublicCache(key);
      results.push(saved);
    }

    return {
      success: true,
      message: 'Curated luxury CMS defaults seeded successfully.',
      count: results.length,
      blocks: results,
    };
  }

  private async clearPublicCache(key: string): Promise<void> {
    await Promise.all([undefined, 'en', 'ar', 'es', 'pt', 'it'].map((locale) => this.cacheManager.del(`cms:${key}:${locale ?? 'raw'}`)));
  }
}
