import 'dotenv/config';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadAhmedCatalog, validateCatalog } from './ahmed-tours/normalize';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
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
  const catalog = loadAhmedCatalog(sourceDirectory);
  validateCatalog(catalog);

  const sourceSlugs = catalog.map((tour) => tour.slug);
  const prisma = new PrismaService();
  const nonSourceTours = await prisma.tour.findMany({
    where: { slug: { notIn: sourceSlugs } },
    orderBy: { slug: 'asc' },
    select: {
      id: true,
      slug: true,
      titleJsonb: true,
      durationJsonb: true,
      basePriceUsd: true,
      country: true,
      category: true,
      status: true,
      isActive: true,
      _count: {
        select: {
          bookings: true,
          availabilities: true,
          itineraries: true,
          images: true,
          reviews: true,
          favorites: true,
          activityLogs: true,
          journeyRoutes: true,
        },
      },
    },
  });

  const result = {
    mode: execute ? 'execute' : 'dry-run',
    sourceCatalogCount: catalog.length,
    nonSourceTourCount: nonSourceTours.length,
    nonSourceTours,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!execute) {
    await prisma.onModuleDestroy();
    return;
  }

  const protectedTours = nonSourceTours.filter((tour) =>
    tour._count.bookings > 0 ||
    tour._count.reviews > 0 ||
    tour._count.favorites > 0 ||
    tour._count.activityLogs > 0 ||
    tour._count.journeyRoutes > 0,
  );
  const deletableTours = nonSourceTours.filter(
    (tour) => !protectedTours.some((protectedTour) => protectedTour.id === tour.id),
  );
  const processed = await prisma.$transaction(
    async (tx) => {
      const archived = protectedTours.length
        ? await tx.tour.updateMany({
            where: { id: { in: protectedTours.map((tour) => tour.id) } },
            data: { status: 'ARCHIVED', isActive: false },
          })
        : { count: 0 };
      const deletion = deletableTours.length
        ? await tx.tour.deleteMany({ where: { id: { in: deletableTours.map((tour) => tour.id) } } })
        : { count: 0 };
      const publicLegacyCount = await tx.tour.count({
        where: {
          slug: { notIn: sourceSlugs },
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
        },
      });
      if (publicLegacyCount !== 0) {
        throw new Error(
          `Post-prune invariant failed: expected zero public legacy tours, found ${publicLegacyCount}.`,
        );
      }
      return {
        deleted: deletion.count,
        archivedForHistory: archived.count,
        remaining: await tx.tour.count(),
        publicLegacyCount,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        ...processed,
        deletedSlugs: deletableTours.map((tour) => tour.slug),
        archivedForHistory: protectedTours.map((tour) => ({
          slug: tour.slug,
          dependencies: tour._count,
        })),
      },
      null,
      2,
    ),
  );
  await prisma.onModuleDestroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
