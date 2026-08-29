import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  normalizeDunasSourceCatalog,
  type NormalizedDunasSourceTour,
} from './dunas-source-catalog';

type StaleTourDependencies = {
  bookings: number;
  reviews: number;
  favorites: number;
  activityLogs: number;
  availabilities: number;
  journeyRoutes: number;
};

type StaleTourAction = 'archive' | 'delete';

export function staleTourAction(dependencies: StaleTourDependencies): StaleTourAction {
  return Object.values(dependencies).some((count) => count > 0) ? 'archive' : 'delete';
}

export function orderBySourceCatalogId<T extends { slug: string; sourceCatalogId: string | null }>(
  tours: T[],
  currentIdBySlug: Map<string, string | null>,
): T[] {
  const remaining = [...tours];
  const occupiedById = new Map<string, string>();
  for (const [slug, sourceCatalogId] of currentIdBySlug) {
    if (sourceCatalogId) occupiedById.set(sourceCatalogId, slug);
  }
  const ordered: T[] = [];
  while (remaining.length) {
    const index = remaining.findIndex((tour) => {
      const holder = tour.sourceCatalogId ? occupiedById.get(tour.sourceCatalogId) : undefined;
      return !holder || holder === tour.slug;
    });
    if (index < 0) {
      throw new Error(`Circular sourceCatalogId reassignment: ${remaining.map((tour) => tour.slug).join(', ')}`);
    }
    const [next] = remaining.splice(index, 1);
    const previousId = currentIdBySlug.get(next.slug);
    if (previousId) occupiedById.delete(previousId);
    if (next.sourceCatalogId) occupiedById.set(next.sourceCatalogId, next.slug);
    currentIdBySlug.set(next.slug, next.sourceCatalogId);
    ordered.push(next);
  }
  return ordered;
}

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function sourceData(tour: NormalizedDunasSourceTour): Record<string, unknown> {
  return tour.sourceCodeJsonb;
}

function sourceNumber(tour: NormalizedDunasSourceTour, key: string): number | null {
  const value = sourceData(tour)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sourceString(tour: NormalizedDunasSourceTour, key: string): string | null {
  const value = sourceData(tour)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function sourceFamily(tour: NormalizedDunasSourceTour): string {
  return sourceString(tour, 'sourceFamily') ?? 'unknown';
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function canonicalContent(tour: NormalizedDunasSourceTour) {
  return {
    sourceCatalogId: tour.sourceCatalogId,
    titleJsonb: tour.titleJsonb,
    subtitleJsonb: tour.subtitleJsonb,
    highlightsJsonb: tour.highlightsJsonb,
    departureInfoJsonb: tour.departureInfoJsonb,
    sourceCodeJsonb: tour.sourceCodeJsonb,
    market: sourceString(tour, 'market'),
    sourceRating: sourceNumber(tour, 'rating'),
    sourceReviewCount: sourceNumber(tour, 'reviewCount'),
    category: tour.category,
    durationJsonb: tour.durationJsonb,
    overviewJsonb: tour.overviewJsonb,
    minPaxJsonb: tour.minPaxJsonb,
    country: tour.country,
    excludedServicesJsonb: tour.excludedServicesJsonb,
    hotelInfoJsonb: tour.hotelInfoJsonb,
    includedServicesJsonb: tour.includedServicesJsonb,
    tags: ['dunas-static-source', sourceFamily(tour), tour.country.toLowerCase()],
  };
}

function tourData(tour: NormalizedDunasSourceTour) {
  const content = canonicalContent(tour);
  return {
    ...content,
    sourceCodeJsonb: json(content.sourceCodeJsonb),
    titleJsonb: json(content.titleJsonb),
    subtitleJsonb: json(content.subtitleJsonb),
    highlightsJsonb: json(content.highlightsJsonb),
    departureInfoJsonb: json(content.departureInfoJsonb),
    durationJsonb: json(content.durationJsonb),
    overviewJsonb: json(content.overviewJsonb),
    minPaxJsonb: json(content.minPaxJsonb),
    includedServicesJsonb: json(content.includedServicesJsonb),
    excludedServicesJsonb: json(content.excludedServicesJsonb),
    hotelInfoJsonb: content.hotelInfoJsonb ? json(content.hotelInfoJsonb) : Prisma.JsonNull,
    sourceRating: content.sourceRating === null ? null : new Prisma.Decimal(content.sourceRating),
  };
}

function fingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fingerprintValue);
  if (!value || typeof value !== 'object') return value;
  const withJson = value as { toJSON?: () => unknown };
  if (typeof withJson.toJSON === 'function') return fingerprintValue(withJson.toJSON());
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, fingerprintValue(nested)]),
  );
}

function fingerprint(value: unknown): string {
  return JSON.stringify(fingerprintValue(value));
}

function fieldDiffs(current: Record<string, unknown>, expected: Record<string, unknown>): string[] {
  return Object.keys(expected).filter((key) => {
    if (key === 'sourceRating' && current[key] !== null && expected[key] !== null) {
      return Number(current[key]) !== Number(expected[key]);
    }
    return fingerprint(current[key]) !== fingerprint(expected[key]);
  });
}

async function replaceTourPresentation(
  tx: Prisma.TransactionClient,
  tourId: string,
  source: NormalizedDunasSourceTour,
  destinationPageId: string,
): Promise<void> {
  await tx.tourImage.deleteMany({ where: { tourId } });
  await tx.tourItinerary.deleteMany({ where: { tourId } });
  await tx.tourLandingPageTour.deleteMany({
    where: { tourId, landingPage: { type: 'DESTINATION' } },
  });
  if (source.images.length) {
    await tx.tourImage.createMany({
      data: source.images.map((image, index) => ({
        tourId,
        imageUrl: image.imageUrl,
        altText: image.altText,
        isHero: index === 0,
        sortOrder: image.sortOrder,
      })),
    });
  }
  if (source.itinerary.length) {
    await tx.tourItinerary.createMany({
      data: source.itinerary.map((day) => ({
        tourId,
        dayLabel: day.dayLabel,
        descriptionJsonb: day.descriptionJsonb,
        mealsJsonb: day.mealsJsonb ? json(day.mealsJsonb) : Prisma.JsonNull,
        sortOrder: day.sortOrder,
      })),
    });
  }
  await tx.tourLandingPageTour.create({
    data: {
      tourId,
      landingPageId: destinationPageId,
      sortOrder: 0,
      isFeatured: false,
      isVisible: true,
    },
  });
}

export async function reconcileCatalog(
  prisma: PrismaService,
  sourceCatalog: NormalizedDunasSourceTour[],
  execute: boolean,
) {
  const destinationSlugs = [...new Set(sourceCatalog.map((tour) => tour.destinationSlug))];
  const [databaseTours, destinationPages] = await Promise.all([
    prisma.tour.findMany({
      where: { deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        itineraries: { orderBy: { sortOrder: 'asc' } },
        landingPages: { where: { landingPage: { type: 'DESTINATION' } }, select: { landingPage: { select: { slug: true } } } },
        _count: { select: { bookings: true, reviews: true, favorites: true, activityLogs: true, availabilities: true, journeyRoutes: true } },
      },
    }),
    prisma.tourLandingPage.findMany({
      where: { deletedAt: null, type: 'DESTINATION', slug: { in: destinationSlugs } },
      select: { id: true, slug: true },
    }),
  ]);
  const destinationBySlug = new Map(destinationPages.map((page) => [page.slug, page]));
  const missingDestinationPages = destinationSlugs.filter((slug) => !destinationBySlug.has(slug));
  if (missingDestinationPages.length) throw new Error(`Missing destination landing pages: ${missingDestinationPages.join(', ')}`);

  const currentBySlug = new Map(databaseTours.map((tour) => [tour.slug, tour]));
  const sourceSlugs = new Set(sourceCatalog.map((tour) => tour.slug));
  const changes: Array<{ slug: string; action: 'create' | 'update'; fields: string[] }> = [];

  const orderedSourceCatalog = orderBySourceCatalogId(
    sourceCatalog,
    new Map(databaseTours.map((tour) => [tour.slug, tour.sourceCatalogId])),
  );
  for (const source of orderedSourceCatalog) {
    const expected = canonicalContent(source);
    const current = currentBySlug.get(source.slug);
    const currentDestination = current?.landingPages.map((link) => link.landingPage.slug) ?? [];
    const fields = current
      ? fieldDiffs(current as unknown as Record<string, unknown>, expected)
      : Object.keys(expected);
    if (currentDestination.length !== 1 || currentDestination[0] !== source.destinationSlug) fields.push('destinationRelation');
    if (!current || fields.length) changes.push({ slug: source.slug, action: current ? 'update' : 'create', fields });

    if (!execute || (!fields.length && current)) continue;
    const page = destinationBySlug.get(source.destinationSlug)!;
    await prisma.$transaction(async (tx) => {
      const persisted = current
        ? await tx.tour.update({ where: { id: current.id }, data: { ...tourData(source), deletedAt: null, isActive: true, status: 'PUBLISHED' } })
        : await tx.tour.create({
          data: {
            ...tourData(source),
            slug: source.slug,
            basePriceUsd: 0,
            currency: 'USD',
            isActive: true,
            status: 'PUBLISHED',
          },
        });
      await replaceTourPresentation(tx, persisted.id, source, page.id);
    }, { maxWait: 10_000, timeout: 60_000 });
  }

  const stale = databaseTours.filter((tour) => !sourceSlugs.has(tour.slug)).map((tour) => ({
    slug: tour.slug,
    id: tour.id,
    action: staleTourAction(tour._count),
    dependencies: tour._count,
  }));
  if (execute) {
    for (const tour of stale) {
      await prisma.$transaction(async (tx) => {
        if (tour.action === 'archive') {
          await tx.tour.update({ where: { id: tour.id }, data: { deletedAt: new Date(), isActive: false, status: 'ARCHIVED' } });
          return;
        }
        await tx.tourLandingPageTour.deleteMany({ where: { tourId: tour.id } });
        await tx.tourImage.deleteMany({ where: { tourId: tour.id } });
        await tx.tourItinerary.deleteMany({ where: { tourId: tour.id } });
        await tx.tour.delete({ where: { id: tour.id } });
      });
    }
  }

  return {
    mode: execute ? 'execute' : 'dry-run',
    sourceTourCount: sourceCatalog.length,
    databaseTourCount: databaseTours.length,
    created: changes.filter((change) => change.action === 'create'),
    updated: changes.filter((change) => change.action === 'update'),
    unchanged: sourceCatalog.length - changes.length,
    archived: stale.filter((tour) => tour.action === 'archive'),
    deleted: stale.filter((tour) => tour.action === 'delete'),
    generatedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const sourceDirectory = path.resolve(
    argumentValue('source') ?? path.join(process.cwd(), '..', 'DUNASTRAVEL-private-main', 'src', 'data'),
  );
  const reportPath = argumentValue('report') ? path.resolve(argumentValue('report')!) : undefined;
  const sourceCatalog = (await normalizeDunasSourceCatalog(sourceDirectory)).tours;
  const prisma = new PrismaService();
  try {
    const report = await reconcileCatalog(prisma, sourceCatalog, execute);
    if (reportPath) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.onModuleDestroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
