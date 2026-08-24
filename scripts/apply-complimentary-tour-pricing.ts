import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { isComplimentaryTourCountry } from '../src/common/domain/tour-pricing-policy';

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const prisma = new PrismaService();

  try {
    const tours = await prisma.tour.findMany({
      where: {
        deletedAt: null,
        country: { equals: 'Egypt', mode: 'insensitive' },
      },
      select: {
        id: true,
        slug: true,
        country: true,
        basePriceUsd: true,
        status: true,
        isActive: true,
      },
      orderBy: { slug: 'asc' },
    });

    if (tours.some((tour) => !isComplimentaryTourCountry(tour.country))) {
      throw new Error(
        'Country pricing selection violated the complimentary pricing policy',
      );
    }

    const changed = tours.filter((tour) => !tour.basePriceUsd.equals(0));
    if (execute && changed.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.tour.updateMany({
          where: { id: { in: changed.map((tour) => tour.id) } },
          data: { basePriceUsd: new Prisma.Decimal(0) },
        });
        await tx.tourActivityLog.createMany({
          data: changed.map((tour) => ({
            tourId: tour.id,
            action: 'TOUR_COMPLIMENTARY_PRICE_APPLIED',
            details: {
              country: tour.country,
              previousBasePriceUsd: tour.basePriceUsd.toString(),
              basePriceUsd: '0',
              source: 'apply-complimentary-tour-pricing',
            },
          })),
        });
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: execute ? 'execute' : 'dry-run',
          matched: tours.length,
          changed: changed.length,
          alreadyZero: tours.length - changed.length,
          tours: tours.map((tour) => ({
            slug: tour.slug,
            previousBasePriceUsd: tour.basePriceUsd.toString(),
            basePriceUsd: '0',
            status: tour.status,
            isActive: tour.isActive,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
