import 'dotenv/config';
import * as path from 'path';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadAhmedCatalog, validateCatalog } from './ahmed-tours/normalize';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const sourceDirectory = path.resolve(
    argValue('source') ??
      path.join(process.cwd(), '..', 'dunas-travel2026.com', 'src', 'data', 'داتا احمد'),
  );
  const catalog = loadAhmedCatalog(sourceDirectory);
  validateCatalog(catalog);
  const slugs = catalog.map((tour) => tour.slug);
  const prisma = new PrismaService();

  const [tourCount, bookingCount, availabilityCount, sourceTours, sourceBookingCount] =
    await Promise.all([
      prisma.tour.count(),
      prisma.booking.count(),
      prisma.tourAvailability.count(),
      prisma.tour.findMany({
        where: { slug: { in: slugs } },
        select: {
          slug: true,
          titleJsonb: true,
          basePriceUsd: true,
          status: true,
          isActive: true,
          _count: { select: { itineraries: true, availabilities: true, bookings: true } },
        },
      }),
      prisma.booking.count({ where: { tour: { slug: { in: slugs } } } }),
    ]);

  const found = new Set(sourceTours.map((tour) => tour.slug));
  const missingSlugs = slugs.filter((slug) => !found.has(slug));
  const invalidPublished = sourceTours
    .filter(
      (tour) =>
        tour.status === 'PUBLISHED' &&
        tour.isActive &&
        tour.basePriceUsd.lte(0),
    )
    .map((tour) => tour.slug);
  const samples = sourceTours
    .filter((tour) =>
      ['complete-egypt-8d', 'reg-22-stop-over-dubai', 'mrc-01-spices-of-morocco'].includes(
        tour.slug,
      ),
    )
    .map((tour) => ({
      slug: tour.slug,
      title: tour.titleJsonb,
      priceUsd: tour.basePriceUsd.toString(),
      status: tour.status,
      active: tour.isActive,
      ...tour._count,
    }));

  const result = {
    sourceCatalogCount: catalog.length,
    importedSourceTours: sourceTours.length,
    missingSlugs,
    invalidPublished,
    database: {
      tours: tourCount,
      bookings: bookingCount,
      availabilities: availabilityCount,
      sourceLinkedBookings: sourceBookingCount,
    },
    sourceTours: {
      publishedActive: sourceTours.filter(
        (tour) => tour.status === 'PUBLISHED' && tour.isActive,
      ).length,
      publishedInactive: sourceTours.filter(
        (tour) => tour.status === 'PUBLISHED' && !tour.isActive,
      ).length,
      drafts: sourceTours.filter((tour) => tour.status === 'DRAFT').length,
      withPositivePrice: sourceTours.filter((tour) => tour.basePriceUsd.gt(0)).length,
    },
    samples,
  };

  console.log(JSON.stringify(result, null, 2));
  await prisma.onModuleDestroy();
  process.exit(missingSlugs.length || invalidPublished.length ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
