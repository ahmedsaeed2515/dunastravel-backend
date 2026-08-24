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

  const linkedBookings = nonSourceTours.reduce(
    (total, tour) => total + tour._count.bookings,
    0,
  );
  if (linkedBookings > 0) {
    throw new Error(
      `Refusing to delete ${nonSourceTours.length} tours because they have ${linkedBookings} linked bookings. Reassign or explicitly remove those bookings first.`,
    );
  }

  const ids = nonSourceTours.map((tour) => tour.id);
  const deleted = await prisma.$transaction(
    async (tx) => {
      const deletion = await tx.tour.deleteMany({ where: { id: { in: ids } } });
      const remaining = await tx.tour.count();
      if (remaining !== sourceSlugs.length) {
        throw new Error(
          `Post-delete invariant failed: expected ${sourceSlugs.length} tours, found ${remaining}.`,
        );
      }
      return { deleted: deletion.count, remaining };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  console.log(JSON.stringify({ success: true, ...deleted }, null, 2));
  await prisma.onModuleDestroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
