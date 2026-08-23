import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
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
  errors: Array<{ slug: string; message: string }>;
  generatedAt: string;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

interface ExistingTourContent {
  basePriceUsd: Prisma.Decimal;
  titleJsonb: unknown;
  durationJsonb: unknown;
  overviewJsonb: unknown;
  minPaxJsonb: unknown;
  includedServicesJsonb: unknown;
  excludedServicesJsonb: unknown;
}

function mergeLocalized(existing: unknown, incoming: unknown): Prisma.InputJsonValue {
  const existingRecord =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  const incomingRecord =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? (incoming as Record<string, unknown>)
      : {};
  return json({ ...existingRecord, ...incomingRecord });
}

function tourData(tour: NormalizedTour, existing?: ExistingTourContent) {
  const knownPrice = tour.basePriceUsd !== null;
  return {
    titleJsonb: mergeLocalized(existing?.titleJsonb, tour.titleJsonb),
    durationJsonb: mergeLocalized(existing?.durationJsonb, tour.durationJsonb),
    overviewJsonb: mergeLocalized(existing?.overviewJsonb, tour.overviewJsonb),
    minPaxJsonb: mergeLocalized(existing?.minPaxJsonb, tour.minPaxJsonb),
    includedServicesJsonb: mergeLocalized(
      existing?.includedServicesJsonb,
      tour.includedServicesJsonb,
    ),
    excludedServicesJsonb: mergeLocalized(
      existing?.excludedServicesJsonb,
      tour.excludedServicesJsonb,
    ),
    category: tour.category,
    country: tour.country,
    currency: tour.currency,
    languages: tour.languages,
    tags: tour.tags,
    ...(knownPrice ? { basePriceUsd: tour.basePriceUsd! } : {}),
    ...(!knownPrice && existing?.basePriceUsd.gt(0)
      ? {}
      : { status: tour.status, isActive: tour.isActive }),
  };
}

async function replaceChildren(
  prisma: Prisma.TransactionClient,
  tourId: string,
  tour: NormalizedTour,
): Promise<void> {
  if (tour.itineraries.length > 0) {
    await prisma.tourItinerary.deleteMany({ where: { tourId } });
    await prisma.tourItinerary.createMany({
      data: tour.itineraries.map((day) => ({
        tourId,
        dayLabel: day.dayLabel.slice(0, 50),
        descriptionJsonb: json(day.descriptionJsonb),
        mealsJsonb: day.mealsJsonb ? json(day.mealsJsonb) : Prisma.JsonNull,
        sortOrder: day.sortOrder,
      })),
    });
  }
  if (tour.images.length > 0) {
    await prisma.tourImage.deleteMany({ where: { tourId } });
    await prisma.tourImage.createMany({
      data: tour.images.map((image) => ({ tourId, ...image })),
    });
  }
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
      path.join(process.cwd(), '..', 'dunas-travel2026.com', 'src', 'data', 'داتا احمد'),
  );
  const availabilityDays = Math.max(0, Number(argValue('availability-days') ?? 0));
  const capacity = Math.max(1, Number(argValue('capacity') ?? 30));
  const outputPath = path.resolve(
    argValue('output-report') ?? path.join(process.cwd(), 'reports', 'ahmed-tour-import.json'),
  );
  const snapshotPath = argValue('write-snapshot');
  const catalog = loadAhmedCatalog(sourceDirectory);
  validateCatalog(catalog);

  if (snapshotPath) {
    const absoluteSnapshot = path.resolve(snapshotPath);
    fs.mkdirSync(path.dirname(absoluteSnapshot), { recursive: true });
    fs.writeFileSync(absoluteSnapshot, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
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
    publishedCount: catalog.filter((tour) => tour.status === 'PUBLISHED').length,
    draftCount: catalog.filter((tour) => tour.status === 'DRAFT').length,
    created: [],
    updated: [],
    unchangedExistingBookings: existing.reduce(
      (sum, tour) => sum + tour._count.bookings,
      0,
    ),
    availabilitySlotsCreated: 0,
    errors: [],
    generatedAt: new Date().toISOString(),
  };

  const activeTourIds: string[] = [];
  for (const tour of catalog) {
    const current = existingBySlug.get(tour.slug);
    if (!execute) {
      (current ? report.updated : report.created).push(tour.slug);
      continue;
    }
    try {
      const saved = await prisma.$transaction(async (tx) => {
        if (current) {
          const updated = await tx.tour.update({
            where: { slug: tour.slug },
            data: tourData(tour, current),
          });
          await replaceChildren(tx, updated.id, tour);
          return updated;
        }
        const created = await tx.tour.create({
          data: {
            slug: tour.slug,
            basePriceUsd: tour.basePriceUsd ?? 0,
            ...tourData(tour),
          },
        });
        await replaceChildren(tx, created.id, tour);
        return created;
      });
      (current ? report.updated : report.created).push(tour.slug);
      if (saved.status === 'PUBLISHED' && saved.isActive && saved.basePriceUsd.gt(0)) {
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
