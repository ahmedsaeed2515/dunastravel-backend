import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GroundedTourRecommendation {
  id: string;
  slug: string;
  title: string;
  category?: string;
  destination: string;
  price: number;
  currency: string;
  durationDays?: number;
  duration?: string;
  image?: string;
  publicUrl: string;
  matchScore?: number;
  matchReasons?: string[];
  highlights?: string[];
}

export interface GroundedDestinationRecommendation {
  id: string;
  slug: string;
  title: string;
  country?: string;
  heroImage?: string;
  publicUrl: string;
}

export interface TravelConstraints {
  destination?: string;
  destinations?: string[];
  country?: string;
  targetDuration?: number;
  durationDays?: number;
  minDuration?: number;
  maxDuration?: number;
  maxBudget?: number;
  currency?: string;
  preferredCurrency?: string;
  nileCruiseRequired?: boolean;
  beachRequired?: boolean;
  luxuryTier?: string;
}

export interface TourComparisonItem {
  id: string;
  slug: string;
  title: string;
  durationDays: number;
  price: number;
  currency: string;
  destination: string;
  hasNileCruise: boolean;
  hasRedSeaBeach: boolean;
  category: string;
  image?: string;
  publicUrl: string;
  highlights: string[];
}

export interface StructuredTourComparison {
  tours: TourComparisonItem[];
  sharedFeatures: string[];
  differences: Array<{
    aspect: string;
    tourAValue: string;
    tourBValue: string;
  }>;
  summaryRecommendation: string;
}

@Injectable()
export class TourCatalogToolService {
  private readonly logger = new Logger(TourCatalogToolService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¿¡]/g, ' ')
      .trim();
  }

  /**
   * Deterministic travel constraint extraction from traveler user message
   * with full negation resistance (e.g. "مش 7 أيام، 10 أيام", "بدون كروز", "مش دبي، عايز تركيا")
   */
  extractTravelConstraints(message: string): TravelConstraints {
    const text = this.normalizeText(message);
    const raw = message || '';
    const constraints: TravelConstraints = {};

    // 1. Nile Cruise Negation vs Positive Detection
    const hasNileNegation =
      /(بدون|من\s+غير|لا\s+اريد|لا\s+أريد|مش\s+عايز|مش\s+محتاج|احذف|ما\s+بدي|no|without|dont\s+want|do\s+not\s+want|exclude|remove)\s*(نايل\s*كروز|كروز|نيل|دهبية|دهبيه|nile|cruise|dahabiya)/i.test(raw) ||
      /(نايل\s*كروز|كروز|نيل|دهبية|دهبيه)\s*(مش\s*لازم|مرفوض|ملغي|لا)/i.test(raw);

    if (hasNileNegation) {
      constraints.nileCruiseRequired = false;
    } else if (
      /(nile|cruise|cruzeiro|crucero|crociera|دهبية|دهبيه|نايل\s*كروز|كروز|نيل)/i.test(text) ||
      /(نايل|كروز|نيل|دهبية)/.test(raw)
    ) {
      constraints.nileCruiseRequired = true;
    }

    // 2. Beach / Red Sea Negation vs Positive Detection
    const hasBeachNegation =
      /(بدون|من\s+غير|لا\s+اريد|لا\s+أريد|مش\s+عايز|مش\s+محتاج|احذف|ما\s+بدي|no|without|dont\s+want|do\s+not\s+want|exclude|remove)\s*(شاطئ|شواطئ|بحر|الغردقة|شرم|beach|beaches|red\s*sea|hurghada|sharm)/i.test(raw) ||
      /(شاطئ|شواطئ|الغردقة|شرم)\s*(مش\s*لازم|مرفوض|ملغي|لا)/i.test(raw);

    if (hasBeachNegation) {
      constraints.beachRequired = false;
    } else if (
      /(sharm|hurghada|red\s*sea|mar\s*vermelho|mar\s*rojo|بحر\s*احمر|شاطئ|شواطئ|شرم|الغردقة)/i.test(text) ||
      /(الغردقة|شرم)/.test(raw)
    ) {
      constraints.beachRequired = true;
    }

    // 3. Duration Extraction with Negation Resistance (e.g. "مش 7 أيام، 10 أيام", "8-day")
    const durationRegex = /(?:(\bnot|\bno|مش|بدون|لا|بدل)[\s-]+)?(\d{1,2})[\s-]*(day|days|dia|dias|giorni|ايام|أيام|يوم)/gi;
    let match: RegExpExecArray | null;
    let chosenDays: number | null = null;

    while ((match = durationRegex.exec(raw)) !== null) {
      const isNegated = Boolean(match[1]);
      const days = parseInt(match[2], 10);
      if (!isNaN(days) && days > 0 && days <= 30) {
        if (!isNegated) {
          chosenDays = days;
        }
      }
    }

    if (chosenDays !== null) {
      constraints.targetDuration = chosenDays;
      constraints.durationDays = chosenDays;
      constraints.minDuration = Math.max(1, chosenDays - 1);
      constraints.maxDuration = chosenDays + 1;
    }

    // 4. Budget Extraction with Currency Awareness (EGP vs USD)
    const egpMatch = raw.match(/(\d{1,3}(?:[,\s]\d{3})*|\d+)\s*(?:(الف|ألف)\s*)?(?:egp|جنيه|جنية|eg)/i);
    if (egpMatch) {
      let rawVal = parseInt(egpMatch[1].replace(/[,\s]/g, ''), 10);
      if (egpMatch[2]) rawVal *= 1000;
      if (!isNaN(rawVal) && rawVal >= 1000) {
        constraints.currency = 'EGP';
        constraints.preferredCurrency = 'EGP';
        constraints.maxBudget = rawVal;
      }
    } else {
      const budgetMatch =
        text.match(/\$?\s*(\d{3,5})\s*(usd|dollar|dolares|dollars|دولار)?/i) ||
        raw.match(/\$?\s*(\d{3,5})\s*(usd|dollar|dolares|dollars|دولار)?/i);
      if (budgetMatch) {
        const val = parseInt(budgetMatch[1], 10);
        if (val >= 500 && val <= 50000 && val !== constraints.targetDuration) {
          constraints.currency = 'USD';
          constraints.preferredCurrency = 'USD';
          constraints.maxBudget = val;
        }
      }
    }

    // 5. Destination Detection with Negation Filtering
    const destinationRules: Array<{ name: string; positiveRegex: RegExp; negativeRegex: RegExp }> = [
      { name: 'Cairo', positiveRegex: /(cairo|القاهرة|قاهرة)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:cairo|القاهرة|قاهرة)/i },
      { name: 'Luxor', positiveRegex: /(luxor|الأقصر|الاقصر|أقصر|اقصر)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:luxor|الأقصر|الاقصر)/i },
      { name: 'Aswan', positiveRegex: /(aswan|أسوان|اسوان)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:aswan|أسوان|اسوان)/i },
      { name: 'Hurghada', positiveRegex: /(hurghada|الغردقة|غردقة)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:hurghada|الغردقة)/i },
      { name: 'Sharm El Sheikh', positiveRegex: /(sharm|شرم)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:sharm|شرم)/i },
      { name: 'Alexandria', positiveRegex: /(alexandria|الإسكندرية|الاسكندرية)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:alexandria|الإسكندرية|الاسكندرية)/i },
      { name: 'Dubai', positiveRegex: /(dubai|دبي)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:dubai|دبي)/i },
      { name: 'Istanbul', positiveRegex: /(istanbul|اسطنبول|إسطنبول)/i, negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:عايز\s+|بدي\s+|اريد\s+|أريد\s+|محتاج\s+|need\s+|want\s+)?(?:istanbul|اسطنبول)/i },
    ];

    const detectedDests: string[] = [];
    for (const d of destinationRules) {
      if (d.positiveRegex.test(raw) && !d.negativeRegex.test(raw)) {
        detectedDests.push(d.name);
      }
    }
    if (detectedDests.length > 0) {
      constraints.destinations = detectedDests;
      constraints.destination = detectedDests[0];
    }

    // 6. Country Detection with Negation Filtering
    const countryRules: Array<{ country: string; positiveRegex: RegExp; negativeRegex: RegExp }> = [
      {
        country: 'Egypt',
        positiveRegex: /(egypt|egito|egipto|egitto|مصر|القاهرة|الاقصر|الأقصر|اسوان|أسوان)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:egypt|مصر|القاهرة)/i,
      },
      {
        country: 'Turkey',
        positiveRegex: /(turkey|turquia|turchia|turquie|تركيا|اسطنبول|إسطنبول|كبادوكيا)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:turkey|تركيا|اسطنبول)/i,
      },
      {
        country: 'Jordan',
        positiveRegex: /(jordan|jordania|giordania|الاردن|الأردن|البتراء|عمان)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:jordan|الاردن|الأردن)/i,
      },
      {
        country: 'Dubai',
        positiveRegex: /(dubai|uae|emiratos|دبي|الامارات|الإمارات|ابوظبي|أبوظبي)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:dubai|uae|دبي|الامارات)/i,
      },
      {
        country: 'Morocco',
        positiveRegex: /(morocco|marruecos|marrocos|marocco|المغرب|مراكش|كازابلانكا|فاس)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:morocco|المغرب|مراكش)/i,
      },
      {
        country: 'Tunisia',
        positiveRegex: /(tunisia|tunez|tunisie|تونس|قرطاج)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:tunisia|تونس)/i,
      },
      {
        country: 'Greece',
        positiveRegex: /(greece|grecia|اليونان|اثينا|أثينا|سانتوريني)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:greece|اليونان|اثينا)/i,
      },
      {
        country: 'Holy Land',
        positiveRegex: /(holy land|tierra santa|terra santa|الاراضي المقدسة|الأراضي المقدسة|القدس)/i,
        negativeRegex: /(?:مش|بدون|لا|not|no|without)\s+(?:holy\s*land|الاراضي\s*المقدسة|القدس)/i,
      },
    ];

    for (const rule of countryRules) {
      if (rule.positiveRegex.test(raw) && !rule.negativeRegex.test(raw)) {
        constraints.country = rule.country;
        break;
      }
    }

    return constraints;
  }

  /**
   * Get Destination Overview, Total Tours Count, and Top Tours
   */
  async getDestinationSummaryAndTours(
    destinationQuery: string,
    locale: string = 'en',
    limit: number = 6,
  ): Promise<{
    destination: string;
    slug: string;
    totalToursCount: number;
    tours: GroundedTourRecommendation[];
    landingPage?: GroundedDestinationRecommendation;
  }> {
    const norm = this.normalizeText(destinationQuery);
    let matchedCountry = 'Egypt';
    let matchedSlug = 'egypt';

    if (/(turkey|turquia|turchia|تركيا|اسطنبول)/i.test(norm)) {
      matchedCountry = 'Turkey';
      matchedSlug = 'turkey';
    } else if (/(dubai|uae|دبي|الامارات|الإمارات)/i.test(norm)) {
      matchedCountry = 'Dubai';
      matchedSlug = 'dubai';
    } else if (/(jordan|jordania|giordania|الاردن|الأردن)/i.test(norm)) {
      matchedCountry = 'Jordan';
      matchedSlug = 'jordan';
    } else if (/(morocco|marruecos|marrocos|المغرب)/i.test(norm)) {
      matchedCountry = 'Morocco';
      matchedSlug = 'morocco';
    } else if (/(tunisia|tunez|تونس)/i.test(norm)) {
      matchedCountry = 'Tunisia';
      matchedSlug = 'tunisia';
    } else if (/(greece|grecia|اليونان)/i.test(norm)) {
      matchedCountry = 'Greece';
      matchedSlug = 'greece';
    } else if (/(holy land|tierra santa|terra santa|الاراضي المقدسة|الأراضي المقدسة)/i.test(norm)) {
      matchedCountry = 'Holy Land';
      matchedSlug = 'holy-land';
    }

    const staticCounts: Record<string, number> = {
      Egypt: 9,
      Turkey: 15,
      Dubai: 9,
      Jordan: 7,
      Morocco: 1,
      Tunisia: 1,
      Greece: 1,
      'Holy Land': 6,
    };

    const destinationKeywords: Record<string, string[]> = {
      Egypt: ['egypt', 'cairo', 'luxor', 'aswan', 'hurghada', 'sharm', 'nile', 'مصر', 'القاهرة', 'الاقصر', 'اسوان', 'الغردقة', 'شرم'],
      Turkey: ['turkey', 'turquia', 'istanbul', 'cappadocia', 'antalya', 'تركيا', 'اسطنبول', 'كبادوكيا'],
      Dubai: ['dubai', 'uae', 'emirates', 'abu dhabi', 'دبي', 'الامارات', 'ابوظبي'],
      Jordan: ['jordan', 'amman', 'petra', 'dead sea', 'الاردن', 'الأردن', 'البتراء', 'عمان'],
      Morocco: ['morocco', 'marrakech', 'casablanca', 'fez', 'المغرب', 'مراكش', 'كازابلانكا'],
      Tunisia: ['tunisia', 'carthage', 'tunis', 'تونس', 'قرطاج'],
      Greece: ['greece', 'athens', 'santorini', 'mykonos', 'اليونان', 'اثينا', 'سانتوريني'],
      'Holy Land': ['holy-land', 'holy land', 'jerusalem', 'bethlehem', 'الاراضي المقدسة', 'الأراضي المقدسة', 'القدس'],
    };

    const searchTokens = destinationKeywords[matchedCountry] || [matchedSlug, matchedCountry.toLowerCase()];

    try {
      const orFilter = searchTokens.flatMap((tok) => [
        { country: { contains: tok, mode: 'insensitive' as const } },
        { city: { contains: tok, mode: 'insensitive' as const } },
        { region: { contains: tok, mode: 'insensitive' as const } },
        { slug: { contains: tok, mode: 'insensitive' as const } },
        { tags: { has: tok } },
      ]);

      const [dbCount, tours, landingPages] = await Promise.all([
        this.prisma.tour.count({
          where: {
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
            OR: orFilter,
          },
        }),
        this.prisma.tour.findMany({
          where: {
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
            OR: orFilter,
          },
          take: limit,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
          include: {
            images: { take: 1, select: { imageUrl: true, isHero: true } },
          },
        }),
        (this.prisma as any).tourLandingPage?.findMany
          ? (this.prisma as any).tourLandingPage.findMany({
              where: {
                isActive: true,
                status: 'PUBLISHED',
                deletedAt: null,
                slug: { contains: matchedSlug, mode: 'insensitive' },
              },
              take: 1,
            })
          : Promise.resolve([]),
      ]);

      const fallbackCount = staticCounts[matchedCountry] || 5;
      const finalCount = Math.max(dbCount, tours.length, fallbackCount);

      const mappedTours = tours.map((t) =>
        this.mapTourToRecommendation(t, locale, [
          locale.startsWith('ar')
            ? `رحلة مميزة في ${matchedCountry}`
            : `Signature curated tour in ${matchedCountry}`,
        ]),
      );

      const mappedLandingPage = landingPages[0]
        ? this.mapDestinationToRecommendation(landingPages[0], locale)
        : {
            id: matchedSlug,
            slug: matchedSlug,
            title: matchedCountry,
            publicUrl: `/destinations/${matchedSlug}`,
          };

      return {
        destination: matchedCountry,
        slug: matchedSlug,
        totalToursCount: finalCount,
        tours: mappedTours,
        landingPage: mappedLandingPage,
      };
    } catch (e: any) {
      this.logger.error(`Error in getDestinationSummaryAndTours: ${e.message}`);
      return {
        destination: matchedCountry,
        slug: matchedSlug,
        totalToursCount: 0,
        tours: [],
      };
    }
  }

  async searchGroundedTours(
    keywords: string[],
    limit: number = 4,
    locale: string = 'en',
    constraints?: TravelConstraints,
  ): Promise<GroundedTourRecommendation[]> {
    try {
      // Fetch active published tours with images
      const tours = await this.prisma.tour.findMany({
        where: {
          isActive: true,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        take: 100,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        include: {
          images: {
            take: 1,
            select: { imageUrl: true, isHero: true },
          },
        },
      });

      if (!tours || tours.length === 0) return [];

      const COMMON_STOPWORDS = new Set([
        'افضل', 'أفضل', 'احسن', 'أحسن', 'وقت', 'ميعاد', 'موعد', 'متى', 'ازاي', 'كيف',
        'هل', 'ما', 'ماذا', 'عايز', 'اريد', 'أريد', 'ممكن', 'في', 'من', 'الى', 'إلى',
        'على', 'عن', 'هو', 'هي', 'مع', 'ده', 'دي', 'مصر', 'egypt', 'best', 'good',
        'time', 'when', 'how', 'what', 'where', 'can', 'should', 'would', 'is', 'the',
        'in', 'to', 'for', 'about', 'visit', 'visiting', 'زيارة', 'سفر', 'سياحة',
      ]);

      const normalizedKeywords = (keywords || [])
        .map((k) => this.normalizeText(k))
        .filter((k) => k.length > 1 && !COMMON_STOPWORDS.has(k));

      // If no specific keywords or constraints were provided, do not force-match catalog tours
      const hasSpecificConstraints = Boolean(
        constraints?.targetDuration ||
        constraints?.nileCruiseRequired ||
        constraints?.beachRequired ||
        constraints?.maxBudget ||
        (normalizedKeywords.length > 0)
      );

      if (!hasSpecificConstraints) {
        return [];
      }

      // Score each tour against keywords & constraints
      const scored = tours.map((tour) => {
        let score = 0;
        let hasDirectConstraintMatch = false;
        const matchReasons: string[] = [];

        // Multilingual titles
        const titles: string[] = [];
        if (tour.titleJsonb && typeof tour.titleJsonb === 'object') {
          Object.values(tour.titleJsonb as Record<string, string>).forEach((v) => {
            if (typeof v === 'string') titles.push(this.normalizeText(v));
          });
        }
        titles.push(this.normalizeText(tour.slug));

        // Destination & category
        const dest = this.normalizeText([tour.city, tour.country, tour.region].filter(Boolean).join(' '));
        const category = this.normalizeText(tour.category || '');
        const tags = (tour.tags || []).map((t) => this.normalizeText(t));
        const fullTourStr = `${titles.join(' ')} ${dest} ${category} ${tags.join(' ')}`;

        // Target Duration Exact Matching
        const tourDuration = this.getTourDurationDays(tour);
        if (constraints?.targetDuration && tourDuration) {
          if (tourDuration === constraints.targetDuration) {
            score += 35;
            hasDirectConstraintMatch = true;
            matchReasons.push(
              locale.startsWith('ar')
                ? `مطابق للمدة المطلوبة (${tourDuration} أيام)`
                : `Matches requested duration (${tourDuration} Days)`,
            );
          } else if (Math.abs(tourDuration - constraints.targetDuration) <= 1) {
            score += 15;
            hasDirectConstraintMatch = true;
          }
        }

        // Constraint checking: Nile Cruise
        if (constraints?.nileCruiseRequired) {
          if (/(nile|cruzeiro|crucero|crociera|دهبية|كروز|نيل)/i.test(fullTourStr)) {
            score += 35;
            hasDirectConstraintMatch = true;
            matchReasons.push(
              locale.startsWith('ar')
                ? 'يشمل برنامج إبحار نيلي فاخر (نايل كروز)'
                : 'Includes signature luxury Nile Cruise navigation',
            );
          }
        }

        // Constraint checking: Beach / Red Sea
        if (constraints?.beachRequired) {
          if (/(sharm|hurghada|red sea|mar vermelho|الغردقة|شرم)/i.test(fullTourStr)) {
            score += 30;
            hasDirectConstraintMatch = true;
            matchReasons.push(
              locale.startsWith('ar')
                ? 'يجمع بين الآثار وشواطئ البحر الأحمر'
                : 'Combines historical exploration with Red Sea beach luxury',
            );
          }
        }

        // Keywords scoring
        let keywordScore = 0;
        normalizedKeywords.forEach((kw) => {
          if (titles.some((t) => t.includes(kw))) {
            keywordScore += 20;
            hasDirectConstraintMatch = true;
          } else if (dest.includes(kw)) {
            keywordScore += 12;
            hasDirectConstraintMatch = true;
          } else if (category.includes(kw)) {
            keywordScore += 10;
          } else if (tags.some((tag) => tag.includes(kw))) {
            keywordScore += 8;
          }
        });
        score += keywordScore;

        // Country matching bonus ONLY IF there is already a direct constraint/keyword match
        if (constraints?.country && hasDirectConstraintMatch) {
          const cNorm = this.normalizeText(constraints.country);
          if (dest.includes(cNorm)) {
            score += 10;
          }
        }

        const price = Number(tour.basePriceUsd);

        // HARD CONSTRAINT: Budget violation (exceeding budget by > 20% strictly disqualifies tour)
        if (constraints?.maxBudget && (!constraints.currency || constraints.currency === 'USD') && constraints.maxBudget > 0) {
          if (price > constraints.maxBudget * 1.2) {
            return null; // Hard disqualified
          }
        }

        // HARD CONSTRAINT: Nile Cruise Negation (user explicitly said "no cruise" / "بدون كروز")
        if (constraints?.nileCruiseRequired === false) {
          if (/(nile|cruzeiro|crucero|crociera|دهبية|كروز|نيل)/i.test(fullTourStr)) {
            return null; // Hard disqualified
          }
        }

        // HARD CONSTRAINT: Beach Negation (user explicitly said "no beach" / "بدون شواطئ")
        if (constraints?.beachRequired === false) {
          if (/(sharm|hurghada|الغردقة|شرم)/i.test(fullTourStr) && !/(cairo|luxor|aswan|القاهرة|الأقصر|اسوان)/i.test(fullTourStr)) {
            return null; // Hard disqualified pure beach resort package
          }
        }

        if (constraints?.maxBudget && price > 0) {
          if (price <= constraints.maxBudget) {
            score += 25;
            hasDirectConstraintMatch = true;
            matchReasons.push(
              locale.startsWith('ar')
                ? `ضمن الميزانية المقترحة ($${price} USD)`
                : `Within your specified budget ($${price} USD)`,
            );
          } else {
            score -= 10;
          }
        }

        // Add featured bonus only if tour already proved relevant
        if (tour.isFeatured && hasDirectConstraintMatch) {
          score += 5;
        }

        if (matchReasons.length === 0 && hasDirectConstraintMatch) {
          matchReasons.push(
            locale.startsWith('ar')
              ? 'برنامج سياحي فاخر معتمد من كتالوج دوناس ترافيل'
              : 'Top rated signature luxury itinerary in Egypt catalog',
          );
        }

        return { tour, score, matchReasons, hasDirectConstraintMatch };
      });

      // Only consider tours that actually matched with high confidence (>= 20 points)
      const matched = scored
        .filter((x): x is NonNullable<typeof x> => x !== null && x.hasDirectConstraintMatch && x.score >= 20)
        .sort((a, b) => b.score - a.score);

      if (matched.length === 0) {
        return [];
      }

      // Deduplicate by tour ID or slug before slicing
      const seenIds = new Set<string>();
      const deduplicated: typeof matched = [];
      for (const m of matched) {
        const key = m.tour.id || m.tour.slug;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          deduplicated.push(m);
        }
      }

      const finalEntries = deduplicated.slice(0, limit);

      return finalEntries.map((entry) =>
        this.mapTourToRecommendation(entry.tour, locale, entry.matchReasons),
      );
    } catch (err: any) {
      this.logger.error(`Failed to search grounded tours: ${err.message}`);
      return [];
    }
  }

  async searchGroundedDestinations(
    keywords: string[],
    limit: number = 3,
    locale: string = 'en',
  ): Promise<GroundedDestinationRecommendation[]> {
    try {
      const landingPages = (this.prisma as any).tourLandingPage?.findMany
        ? await (this.prisma as any).tourLandingPage.findMany({
            where: {
              isActive: true,
              status: 'PUBLISHED',
              deletedAt: null,
            },
            take: 30,
            orderBy: { sortOrder: 'asc' },
          })
        : [];

      if (!keywords || keywords.length === 0) {
        return landingPages.slice(0, limit).map((lp: any) => this.mapDestinationToRecommendation(lp, locale));
      }

      const normalizedKeywords = keywords
        .map((k) => this.normalizeText(k))
        .filter((k) => k.length > 1);

      const scored = landingPages.map((lp: any) => {
        let score = 0;
        const titles: string[] = [];
        if (lp.titleJsonb && typeof lp.titleJsonb === 'object') {
          Object.values(lp.titleJsonb as Record<string, string>).forEach((v) => {
            if (typeof v === 'string') titles.push(this.normalizeText(v));
          });
        }
        titles.push(this.normalizeText(lp.slug));

        normalizedKeywords.forEach((kw) => {
          if (titles.some((t) => t.includes(kw))) score += 10;
        });

        return { lp, score };
      });

      const matched = scored
        .filter((x: any) => x.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .map((x: any) => x.lp);

      const finalPages = matched.length > 0 ? matched.slice(0, limit) : landingPages.slice(0, limit);
      return finalPages.map((lp: any) => this.mapDestinationToRecommendation(lp, locale));
    } catch (err: any) {
      this.logger.error(`Failed to search destinations: ${err.message}`);
      return [];
    }
  }

  /**
   * Deterministic Tour Comparison Engine
   */
  async compareTwoTours(tourAIdOrSlug?: string, tourBIdOrSlug?: string, locale: string = 'en'): Promise<StructuredTourComparison | null> {
    try {
      const idsOrSlugs = [tourAIdOrSlug, tourBIdOrSlug].filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim()));
      let tours: any[] = [];

      if (idsOrSlugs.length > 0 && (this.prisma as any).tour?.findMany) {
        tours = await (this.prisma as any).tour.findMany({
          where: {
            OR: [
              { id: { in: idsOrSlugs } },
              { slug: { in: idsOrSlugs } },
            ],
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          include: {
            images: { take: 1, select: { imageUrl: true } },
          },
        });
      }

      // If fewer than 2 tours matched, supplement with top published active tours
      if (tours.length < 2 && (this.prisma as any).tour?.findMany) {
        const existingIds = tours.map((t) => t.id);
        const needed = 2 - tours.length;
        const additionalTours = await (this.prisma as any).tour.findMany({
          where: {
            id: { notIn: existingIds },
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          take: needed,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
          include: {
            images: { take: 1, select: { imageUrl: true } },
          },
        });
        tours = [...tours, ...additionalTours];
      }

      if (tours.length < 2) return null;

      const [tourA, tourB] = tours;
      const isArabic = locale.startsWith('ar');

      const formatTour = (t: any): TourComparisonItem => {
        const lang = locale.split('-')[0].toLowerCase();
        let title = t.slug;
        if (t.titleJsonb && typeof t.titleJsonb === 'object') {
          const tMap = t.titleJsonb as Record<string, string>;
          title = tMap[lang] || tMap.en || tMap.ar || title;
        }

        const fullStr = `${title} ${t.city || ''} ${t.category || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
        const hasNileCruise = /(nile|cruise|cruzeiro|crociera|دهبية|كروز|نيل)/.test(fullStr);
        const hasRedSeaBeach = /(sharm|hurghada|red sea|الغردقة|شرم)/.test(fullStr);

        const dDays = this.getTourDurationDays(t);
        return {
          id: t.id,
          slug: t.slug,
          title,
          durationDays: dDays,
          price: 0,
          currency: t.currency || 'USD',
          destination: [t.city, t.country].filter(Boolean).join(', ') || 'Egypt',
          hasNileCruise,
          hasRedSeaBeach,
          category: t.category || 'Luxury',
          image: t.images?.[0]?.imageUrl,
          publicUrl: `/tours/${t.slug}`,
          highlights: t.tags?.slice(0, 4) || [],
        };
      };

      const compA = formatTour(tourA);
      const compB = formatTour(tourB);

      const sharedFeatures = [
        isArabic ? 'إقامة 5 نجوم فاخرة مع استقبال وتوديع VIP بالمطار' : '5-Star luxury accommodations & VIP airport concierge',
        isArabic ? 'مرشد سياحي خاص مرخص وخبير في الآثار المصرية' : 'Private licensed Egyptologist guide',
        isArabic ? 'تنقلات بسيارات حديثة مكيفة ومريحة' : 'Private executive ground transportation',
      ];

      const differences = [
        {
          aspect: isArabic ? 'المدة الإجمالية للبرنامج' : 'Total Trip Duration',
          tourAValue: `${compA.durationDays} ${isArabic ? 'أيام' : 'Days'}`,
          tourBValue: `${compB.durationDays} ${isArabic ? 'أيام' : 'Days'}`,
        },
        {
          aspect: isArabic ? 'سعر الباقة يبدأ من' : 'Starting Price per Person',
          tourAValue: compA.price > 0 ? `$${compA.price} ${compA.currency}` : (isArabic ? 'عند الطلب (عرض مخصص)' : 'On Request (Private Quote)'),
          tourBValue: compB.price > 0 ? `$${compB.price} ${compB.currency}` : (isArabic ? 'عند الطلب (عرض مخصص)' : 'On Request (Private Quote)'),
        },
        {
          aspect: isArabic ? 'الإبحار في النايل كروز' : 'Nile Cruise Included',
          tourAValue: compA.hasNileCruise ? (isArabic ? 'نعم (نايل كروز فاخر)' : 'Yes (Luxury Nile Cruise)') : (isArabic ? 'غير مشمول' : 'Not Included'),
          tourBValue: compB.hasNileCruise ? (isArabic ? 'نعم (نايل كروز فاخر)' : 'Yes (Luxury Nile Cruise)') : (isArabic ? 'غير مشمول' : 'Not Included'),
        },
        {
          aspect: isArabic ? 'شواطئ البحر الأحمر' : 'Red Sea Beach Extension',
          tourAValue: compA.hasRedSeaBeach ? (isArabic ? 'نعم (منتجع شاطئي)' : 'Yes (Red Sea Resort)') : (isArabic ? 'غير مشمول' : 'Not Included'),
          tourBValue: compB.hasRedSeaBeach ? (isArabic ? 'نعم (منتجع شاطئي)' : 'Yes (Red Sea Resort)') : (isArabic ? 'غير مشمول' : 'Not Included'),
        },
      ];

      const summaryRecommendation = isArabic
        ? `إذا كنت تبحث عن رحلة أطول تجمع بين المعالم والشاطئ فننصحك برحلة "${compA.durationDays > compB.durationDays ? compA.title : compB.title}"، أما إذا كنت تفضل برنامجاً مركزاً وسريعاً فإن "${compA.durationDays <= compB.durationDays ? compA.title : compB.title}" هي الخيار الأنسب.`
        : `If you prefer a comprehensive journey including coastal relaxation, choose "${compA.durationDays > compB.durationDays ? compA.title : compB.title}". For a classic and focused exploration, "${compA.durationDays <= compB.durationDays ? compA.title : compB.title}" provides the premier experience.`;

      return {
        tours: [compA, compB],
        sharedFeatures,
        differences,
        summaryRecommendation,
      };
    } catch (err: any) {
      this.logger.error(`Failed to compare tours: ${err.message}`);
      return null;
    }
  }

  async getToursByIds(tourIds: string[], locale: string = 'en'): Promise<GroundedTourRecommendation[]> {
    if (!tourIds || tourIds.length === 0) return [];
    try {
      const tours = await this.prisma.tour.findMany({
        where: {
          id: { in: tourIds },
          deletedAt: null,
        },
        include: {
          images: {
            take: 1,
            select: { imageUrl: true, isHero: true },
          },
        },
      });

      return tours.map((t) => this.mapTourToRecommendation(t, locale));
    } catch (err: any) {
      this.logger.error(`Failed to get tours by IDs: ${err.message}`);
      return [];
    }
  }

  public mapTourToRecommendation(
    tour: any,
    locale: string = 'en',
    matchReasons?: string[],
  ): GroundedTourRecommendation {
    const lang = locale.split('-')[0].toLowerCase();
    let title = tour.slug;

    if (tour.titleJsonb && typeof tour.titleJsonb === 'object') {
      const tMap = tour.titleJsonb as Record<string, string>;
      title = tMap[lang] || tMap.en || tMap.ar || Object.values(tMap)[0] || title;
    }

    const image =
      tour.images?.[0]?.imageUrl ||
      'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=800&q=80';
    const dest = [tour.city, tour.country].filter(Boolean).join(', ') || 'Egypt';
    const dDays = this.getTourDurationDays(tour);

    const price = Number(tour.basePriceUsd) || 0;

    return {
      id: tour.id,
      slug: tour.slug,
      title,
      category: tour.category || 'Luxury',
      destination: dest,
      price,
      currency: tour.currency || 'USD',
      duration: `${dDays} Days`,
      durationDays: dDays,
      image,
      publicUrl: `/tours/${tour.slug}`,
      matchReasons: matchReasons || [
        locale.startsWith('ar')
          ? 'باقة سياحية فاخرة معتمدة'
          : 'Verified signature luxury itinerary',
      ],
    };
  }

  private mapDestinationToRecommendation(lp: any, locale: string = 'en'): GroundedDestinationRecommendation {
    const lang = locale.split('-')[0].toLowerCase();
    const slug = lp?.slug || 'destination';
    let title = slug.toUpperCase();

    if (lp.titleJsonb && typeof lp.titleJsonb === 'object') {
      const tMap = lp.titleJsonb as Record<string, string>;
      title = tMap[lang] || tMap.en || tMap.ar || Object.values(tMap)[0] || title;
    }

    return {
      id: lp?.id || slug,
      slug,
      title,
      heroImage: lp?.heroImageUrl || undefined,
      publicUrl: `/destinations/${slug}`,
    };
  }

  private getTourDurationDays(tour: any): number {
    if (tour?.durationJsonb && typeof tour.durationJsonb === 'object') {
      const val = (tour.durationJsonb as any).days || (tour.durationJsonb as any).en || (tour.durationJsonb as any).pt;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const m = val.match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }
    const slugMatch = (tour?.slug || '').match(/(\d+)d/i);
    if (slugMatch) return parseInt(slugMatch[1], 10);
    return 8;
  }
}
