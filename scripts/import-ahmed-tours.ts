import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  destinationSlugForCountry,
  loadAhmedCatalog,
  NormalizedTour,
  validateCatalog,
} from './ahmed-tours/normalize';

interface ImportReport {
  mode: 'dry-run' | 'execute';
  sourceDirectory: string;
  catalogCount: number;
  publishedCount: number;
  draftCount: number;
  created: string[];
  updated: string[];
  unchangedExistingBookings: number;
  availabilitySlotsCreated: number;
  destinationRelationsSynced: number;
  destinationLandingPagesCreated: string[];
  tours: Array<{
    sourceId: string;
    slug: string;
    action: 'created' | 'updated';
    destination: string;
    translationCount: number;
    itineraryCount: number;
    mediaCount: number;
    priceUsd: number | null;
    currency: string;
    warnings: string[];
    fieldMismatchCount: number;
  }>;
  errors: Array<{ slug: string; message: string }>;
  generatedAt: string;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** The Ahmed catalog is authoritative during this import: never merge stale DB content. */
function tourData(tour: NormalizedTour) {
  const effectivePrice = new Prisma.Decimal(tour.basePriceUsd ?? 0);
  return {
    sourceCatalogId: tour.sourceId,
    sourceCodeJsonb: json(tour.sourceCodeJsonb),
    titleJsonb: json(tour.titleJsonb),
    subtitleJsonb: json(tour.subtitleJsonb),
    highlightsJsonb: json(tour.highlightsJsonb),
    departureInfoJsonb: json(tour.departureInfoJsonb),
    market: tour.market,
    sourceRating:
      tour.sourceRating === null ? null : new Prisma.Decimal(tour.sourceRating),
    sourceReviewCount: tour.sourceReviewCount,
    durationJsonb: json(tour.durationJsonb),
    overviewJsonb: json(tour.overviewJsonb),
    minPaxJsonb: json(tour.minPaxJsonb),
    includedServicesJsonb: json(tour.includedServicesJsonb),
    excludedServicesJsonb: json(tour.excludedServicesJsonb),
    category: tour.category,
    country: tour.country,
    currency: tour.currency,
    languages: tour.languages,
    tags: tour.tags,
    hotelInfoJsonb: tour.hotelInfoJsonb ? json(tour.hotelInfoJsonb) : Prisma.JsonNull,
    seasonPricingJsonb: tour.seasonPricingJsonb
      ? json(tour.seasonPricingJsonb)
      : Prisma.JsonNull,
    transportationJsonb: tour.transportationJsonb
      ? json(tour.transportationJsonb)
      : Prisma.JsonNull,
    termsJsonb: tour.termsJsonb ? json(tour.termsJsonb) : Prisma.JsonNull,
    basePriceUsd: effectivePrice,
    status: tour.status,
    isActive: tour.isActive,
    // Re-importing the canonical catalog must restore soft-deleted records;
    // publication status still controls public visibility.
    deletedAt: null,
  };
}

async function replaceChildren(
  prisma: Prisma.TransactionClient,
  tourId: string,
  tour: NormalizedTour,
): Promise<void> {
  await prisma.tourItinerary.deleteMany({ where: { tourId } });
  if (tour.itineraries.length > 0) {
    await prisma.tourItinerary.createMany({
      data: tour.itineraries.map((day) => ({
        tourId,
        dayLabel: day.dayLabel.slice(0, 50),
        descriptionJsonb: json(day.descriptionJsonb),
        mealsJsonb: day.mealsJsonb ? json(day.mealsJsonb) : Prisma.JsonNull,
        activitiesJsonb: day.activitiesJsonb
          ? json(day.activitiesJsonb)
          : Prisma.JsonNull,
        hotelsJsonb: day.hotelsJsonb ? json(day.hotelsJsonb) : Prisma.JsonNull,
        transportationJsonb: day.transportationJsonb
          ? json(day.transportationJsonb)
          : Prisma.JsonNull,
        notesJsonb: day.notesJsonb ? json(day.notesJsonb) : Prisma.JsonNull,
        sortOrder: day.sortOrder,
      })),
    });
  }
  await prisma.tourImage.deleteMany({ where: { tourId } });
  if (tour.images.length > 0) {
    await prisma.tourImage.createMany({
      data: tour.images.map((image) => ({ tourId, ...image })),
    });
  }
}

function destinationSlugFor(tour: NormalizedTour): string {
  const destinationSlug = destinationSlugForCountry(tour.country);
  if (!destinationSlug) {
    throw new Error(`No canonical destination mapping for country '${tour.country}'`);
  }
  return destinationSlug;
}

const DESTINATION_TITLES: Record<string, Record<string, string>> = {
  egypt: { en: 'Egypt', ar: 'مصر', es: 'Egipto', pt: 'Egito', it: 'Egitto' },
  turkey: { en: 'Turkey', ar: 'تركيا', es: 'Turquía', pt: 'Turquia', it: 'Turchia' },
  jordan: { en: 'Jordan', ar: 'الأردن', es: 'Jordania', pt: 'Jordânia', it: 'Giordania' },
  morocco: { en: 'Morocco', ar: 'المغرب', es: 'Marruecos', pt: 'Marrocos', it: 'Marocco' },
  greece: { en: 'Greece', ar: 'اليونان', es: 'Grecia', pt: 'Grécia', it: 'Grecia' },
  tunisia: { en: 'Tunisia', ar: 'تونس', es: 'Túnez', pt: 'Tunísia', it: 'Tunisia' },
  dubai: { en: 'Dubai', ar: 'دبي', es: 'Dubái', pt: 'Dubai', it: 'Dubai' },
  'multi-country': {
    en: 'Multi-Country Tours',
    ar: 'رحلات متعددة الدول',
    es: 'Circuitos Multipaís',
    pt: 'Circuitos Multipaíses',
    it: 'Tour Multipaese',
  },
};

async function ensureDestinationLandingPages(
  prisma: PrismaService,
  catalog: NormalizedTour[],
  execute: boolean,
): Promise<string[]> {
  const requiredSlugs = [...new Set(catalog.map(destinationSlugFor))];
  const existing = await prisma.tourLandingPage.findMany({
    where: { slug: { in: requiredSlugs }, type: 'DESTINATION', deletedAt: null },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((page) => page.slug));
  const missing = requiredSlugs.filter((slug) => !existingSlugs.has(slug));
  for (const slug of missing) {
    const titleJsonb = DESTINATION_TITLES[slug];
    if (!titleJsonb) throw new Error(`No source-backed title is available for destination '${slug}'`);
    if (execute) {
      await prisma.tourLandingPage.create({
        data: {
          slug,
          type: 'DESTINATION',
          titleJsonb: json(titleJsonb),
          status: 'PUBLISHED',
          isActive: true,
        },
      });
    }
  }
  return missing;
}

/**
 * TourLandingPage is the established Destination aggregate. Replace its
 * destination links on import, while keeping separately-managed theme links.
 */
async function syncDestinationRelation(
  prisma: Prisma.TransactionClient,
  tourId: string,
  tour: NormalizedTour,
): Promise<void> {
  const destinationSlug = destinationSlugFor(tour);
  const destination = await prisma.tourLandingPage.findFirst({
    where: { slug: destinationSlug, type: 'DESTINATION', deletedAt: null },
    select: { id: true },
  });
  if (!destination) {
    throw new Error(
      `Canonical destination landing page '${destinationSlug}' is missing. Seed destinations before importing tours.`,
    );
  }
  await prisma.tourLandingPageTour.deleteMany({
    where: { tourId, landingPage: { type: 'DESTINATION' } },
  });
  await prisma.tourLandingPageTour.create({
    data: {
      landingPageId: destination.id,
      tourId,
      sortOrder: 0,
      isFeatured: false,
      isVisible: true,
    },
  });
}

async function createAvailability(
  prisma: PrismaService,
  tourIds: string[],
  days: number,
  capacity: number,
): Promise<number> {
  if (days <= 0 || tourIds.length === 0) return 0;
  const data = tourIds.flatMap((tourId) =>
    Array.from({ length: days }, (_, offset) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + offset + 1);
      return {
        tourId,
        date,
        totalCapacity: capacity,
        remainingSeats: capacity,
        status: 'AVAILABLE',
      };
    }),
  );
  const result = await prisma.tourAvailability.createMany({
    data,
    skipDuplicates: true,
  });
  return result.count;
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const sourceDirectory = path.resolve(
    argValue('source') ??
      path.join(
        process.cwd(),
        '..',
        'dunas-travel2026.com',
        'src',
        'data',
        'داتا احمد',
      ),
  );
  const availabilityDays = Math.max(
    0,
    Number(argValue('availability-days') ?? 0),
  );
  const capacity = Math.max(1, Number(argValue('capacity') ?? 30));
  const outputPath = path.resolve(
    argValue('output-report') ??
      path.join(process.cwd(), 'reports', 'ahmed-tour-import.json'),
  );
  const snapshotPath = argValue('write-snapshot');
  const catalog = loadAhmedCatalog(sourceDirectory);
  validateCatalog(catalog);

  if (snapshotPath) {
    const absoluteSnapshot = path.resolve(snapshotPath);
    fs.mkdirSync(path.dirname(absoluteSnapshot), { recursive: true });
    fs.writeFileSync(
      absoluteSnapshot,
      `${JSON.stringify(catalog, null, 2)}\n`,
      'utf8',
    );
  }

  const prisma = new PrismaService();
  const existing = await prisma.tour.findMany({
    where: { slug: { in: catalog.map((tour) => tour.slug) } },
    select: {
      id: true,
      slug: true,
      basePriceUsd: true,
      titleJsonb: true,
      durationJsonb: true,
      overviewJsonb: true,
      minPaxJsonb: true,
      includedServicesJsonb: true,
      excludedServicesJsonb: true,
      status: true,
      isActive: true,
      _count: { select: { bookings: true } },
    },
  });
  const existingBySlug = new Map(existing.map((tour) => [tour.slug, tour]));
  const report: ImportReport = {
    mode: execute ? 'execute' : 'dry-run',
    sourceDirectory,
    catalogCount: catalog.length,
    publishedCount: catalog.filter((tour) => tour.status === 'PUBLISHED')
      .length,
    draftCount: catalog.filter((tour) => tour.status === 'DRAFT').length,
    created: [],
    updated: [],
    unchangedExistingBookings: existing.reduce(
      (sum, tour) => sum + tour._count.bookings,
      0,
    ),
    availabilitySlotsCreated: 0,
    destinationRelationsSynced: 0,
    destinationLandingPagesCreated: [],
    tours: [],
    errors: [],
    generatedAt: new Date().toISOString(),
  };

  report.destinationLandingPagesCreated = await ensureDestinationLandingPages(
    prisma,
    catalog,
    execute,
  );

  const activeTourIds: string[] = [];
  for (const tour of catalog) {
    const current = existingBySlug.get(tour.slug);
    const reportTour = {
      sourceId: tour.sourceId,
      slug: tour.slug,
      action: current ? ('updated' as const) : ('created' as const),
      destination: destinationSlugFor(tour),
      translationCount: tour.languages.length,
      itineraryCount: tour.itineraries.length,
      mediaCount: tour.images.length,
      priceUsd: tour.basePriceUsd,
      currency: tour.currency,
      warnings: tour.basePriceUsd === null ? ['No source base price; imported as DRAFT.'] : [],
      fieldMismatchCount: 0,
    };
    if (!execute) {
      (current ? report.updated : report.created).push(tour.slug);
      report.tours.push(reportTour);
      continue;
    }
    try {
      const saved = await prisma.$transaction(async (tx) => {
        if (current) {
          const updated = await tx.tour.update({
            where: { slug: tour.slug },
            data: tourData(tour),
          });
          await replaceChildren(tx, updated.id, tour);
          await syncDestinationRelation(tx, updated.id, tour);
          return updated;
        }
        const created = await tx.tour.create({
          data: {
            slug: tour.slug,
            ...tourData(tour),
          },
        });
        await replaceChildren(tx, created.id, tour);
        await syncDestinationRelation(tx, created.id, tour);
        return created;
      }, {
        maxWait: 15_000,
        timeout: 45_000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      (current ? report.updated : report.created).push(tour.slug);
      report.tours.push(reportTour);
      report.destinationRelationsSynced++;
      if (saved.status === 'PUBLISHED' && saved.isActive) {
        activeTourIds.push(saved.id);
      }
    } catch (error) {
      report.errors.push({
        slug: tour.slug,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (execute && report.errors.length === 0) {
    report.availabilitySlotsCreated = await createAvailability(
      prisma,
      activeTourIds,
      availabilityDays,
      capacity,
    );
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await prisma.onModuleDestroy();
  process.exit(report.errors.length > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
