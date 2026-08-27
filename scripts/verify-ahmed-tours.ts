import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  destinationSlugForCountry,
  loadAhmedCatalog,
  resolveAhmedSourceDirectory,
  NormalizedTour,
  validateCatalog,
} from './ahmed-tours/normalize';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function jsonOrNull(value: unknown): unknown {
  return value ?? null;
}

function expectedPrice(tour: NormalizedTour): string {
  return new Prisma.Decimal(tour.basePriceUsd ?? 0).toFixed(2);
}

async function main(): Promise<void> {
  const sourceDirectory = path.resolve(
    argValue('source') ?? resolveAhmedSourceDirectory(),
  );
  const outputPath = path.resolve(
    argValue('output') ?? path.join(process.cwd(), 'reports', 'ahmed-full-fidelity-verification.json'),
  );
  const catalog = loadAhmedCatalog(sourceDirectory);
  validateCatalog(catalog);
  const prisma = new PrismaService();
  const sourceSlugs = catalog.map((tour) => tour.slug);
  const [tours, legacyPublic, totals] = await Promise.all([
    prisma.tour.findMany({
      where: { slug: { in: sourceSlugs } },
      include: {
        itineraries: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        landingPages: {
          where: { landingPage: { type: 'DESTINATION', deletedAt: null } },
          select: { landingPage: { select: { slug: true } } },
        },
      },
    }),
    prisma.tour.count({
      where: { slug: { notIn: sourceSlugs }, status: 'PUBLISHED', isActive: true, deletedAt: null },
    }),
    prisma.$transaction([
      prisma.tour.count(),
      prisma.tourItinerary.count({ where: { tour: { slug: { in: sourceSlugs } } } }),
      prisma.tourImage.count({ where: { tour: { slug: { in: sourceSlugs } } } }),
      prisma.tourLandingPageTour.count({
        where: { tour: { slug: { in: sourceSlugs } }, landingPage: { type: 'DESTINATION' } },
      }),
    ]),
  ]);
  const bySlug = new Map(tours.map((tour) => [tour.slug, tour]));
  const fieldMismatches: Array<{ slug: string; fields: string[] }> = [];

  for (const source of catalog) {
    const actual = bySlug.get(source.slug);
    const fields: string[] = [];
    if (!actual) {
      fieldMismatches.push({ slug: source.slug, fields: ['record missing'] });
      continue;
    }
    const comparisons: Array<[string, unknown, unknown]> = [
      ['sourceCatalogId', source.sourceId, actual.sourceCatalogId],
      ['sourceCodeJsonb', source.sourceCodeJsonb, actual.sourceCodeJsonb],
      ['titleJsonb', source.titleJsonb, actual.titleJsonb],
      ['subtitleJsonb', source.subtitleJsonb, actual.subtitleJsonb],
      ['highlightsJsonb', source.highlightsJsonb, actual.highlightsJsonb],
      ['departureInfoJsonb', source.departureInfoJsonb, actual.departureInfoJsonb],
      ['market', source.market, actual.market],
      ['sourceRating', source.sourceRating?.toFixed(2) ?? null, actual.sourceRating?.toFixed(2) ?? null],
      ['sourceReviewCount', source.sourceReviewCount, actual.sourceReviewCount],
      ['durationJsonb', source.durationJsonb, actual.durationJsonb],
      ['overviewJsonb', source.overviewJsonb, actual.overviewJsonb],
      ['minPaxJsonb', source.minPaxJsonb, actual.minPaxJsonb],
      ['includedServicesJsonb', source.includedServicesJsonb, actual.includedServicesJsonb],
      ['excludedServicesJsonb', source.excludedServicesJsonb, actual.excludedServicesJsonb],
      ['hotelInfoJsonb', jsonOrNull(source.hotelInfoJsonb), jsonOrNull(actual.hotelInfoJsonb)],
      ['seasonPricingJsonb', jsonOrNull(source.seasonPricingJsonb), jsonOrNull(actual.seasonPricingJsonb)],
      ['transportationJsonb', jsonOrNull(source.transportationJsonb), jsonOrNull(actual.transportationJsonb)],
      ['termsJsonb', jsonOrNull(source.termsJsonb), jsonOrNull(actual.termsJsonb)],
      ['category', source.category, actual.category],
      ['country', source.country, actual.country],
      ['basePriceUsd', expectedPrice(source), actual.basePriceUsd.toFixed(2)],
      ['currency', source.currency, actual.currency],
      ['status', source.status, actual.status],
      ['isActive', source.isActive, actual.isActive],
      ['languages', source.languages, actual.languages],
      ['tags', source.tags, actual.tags],
    ];
    comparisons.forEach(([field, expected, received]) => {
      if (!same(expected, received)) fields.push(field);
    });
    const expectedDestination = destinationSlugForCountry(source.country);
    if (!actual.landingPages.some((relation) => relation.landingPage.slug === expectedDestination)) {
      fields.push('destinationRelation');
    }
    if (actual.itineraries.length !== source.itineraries.length) fields.push('itinerary.count');
    source.itineraries.forEach((expected, index) => {
      const received = actual.itineraries[index];
      if (!received) return;
      const itineraryComparisons: Array<[string, unknown, unknown]> = [
        ['dayLabel', expected.dayLabel, received.dayLabel],
        ['descriptionJsonb', expected.descriptionJsonb, received.descriptionJsonb],
        ['mealsJsonb', jsonOrNull(expected.mealsJsonb), jsonOrNull(received.mealsJsonb)],
        ['activitiesJsonb', jsonOrNull(expected.activitiesJsonb), jsonOrNull(received.activitiesJsonb)],
        ['hotelsJsonb', jsonOrNull(expected.hotelsJsonb), jsonOrNull(received.hotelsJsonb)],
        ['transportationJsonb', jsonOrNull(expected.transportationJsonb), jsonOrNull(received.transportationJsonb)],
        ['notesJsonb', jsonOrNull(expected.notesJsonb), jsonOrNull(received.notesJsonb)],
        ['sortOrder', expected.sortOrder, received.sortOrder],
      ];
      itineraryComparisons.forEach(([field, expectedValue, receivedValue]) => {
        if (!same(expectedValue, receivedValue)) fields.push(`itinerary.${index}.${field}`);
      });
    });
    if (actual.images.length !== source.images.length) fields.push('images.count');
    source.images.forEach((expected, index) => {
      const received = actual.images[index];
      if (!received || !same(expected.imageUrl, received.imageUrl) || expected.isHero !== received.isHero || expected.altText !== received.altText || expected.sortOrder !== received.sortOrder) {
        fields.push(`images.${index}`);
      }
    });
    if (fields.length > 0) fieldMismatches.push({ slug: source.slug, fields });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    sourceCatalogCount: catalog.length,
    importedCanonicalTours: tours.length,
    totalDatabaseTours: totals[0],
    canonicalItineraryRows: totals[1],
    canonicalMediaRows: totals[2],
    destinationRelations: totals[3],
    publicNonAhmedTours: legacyPublic,
    fieldMismatchCount: fieldMismatches.reduce((total, item) => total + item.fields.length, 0),
    fieldMismatches,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  await prisma.onModuleDestroy();
  process.exit(result.fieldMismatchCount || legacyPublic ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
