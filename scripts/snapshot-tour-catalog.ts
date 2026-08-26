import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../src/prisma/prisma.service';

function outputPath(): string {
  const arg = process.argv.find((value) => value.startsWith('--output='));
  return path.resolve(
    arg?.slice('--output='.length) ??
      path.join(process.cwd(), 'reports', 'tour-catalog-pre-import-snapshot.json'),
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  const [tours, destinations, counts] = await Promise.all([
    prisma.tour.findMany({
      orderBy: { slug: 'asc' },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        itineraries: { orderBy: { sortOrder: 'asc' } },
        landingPages: {
          include: { landingPage: { select: { slug: true, type: true } } },
          orderBy: { landingPage: { slug: 'asc' } },
        },
        _count: {
          select: {
            bookings: true,
            availabilities: true,
            reviews: true,
            favorites: true,
            activityLogs: true,
            journeyRoutes: true,
          },
        },
      },
    }),
    prisma.tourLandingPage.findMany({
      where: { type: 'DESTINATION' },
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        status: true,
        isActive: true,
        deletedAt: true,
        _count: { select: { tours: true } },
      },
    }),
    Promise.all([
      prisma.tour.count(),
      prisma.booking.count(),
      prisma.tourAvailability.count(),
      prisma.tourImage.count(),
      prisma.tourItinerary.count(),
      prisma.tourLandingPageTour.count(),
      prisma.tourReview.count(),
      prisma.tourFavorite.count(),
      prisma.tourActivityLog.count(),
    ]),
  ]);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
    counts: {
      tours: counts[0],
      bookings: counts[1],
      availabilities: counts[2],
      images: counts[3],
      itineraries: counts[4],
      destinationRelations: counts[5],
      reviews: counts[6],
      favorites: counts[7],
      activityLogs: counts[8],
    },
    destinations,
    tours,
  };
  const target = outputPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: target, ...snapshot.counts }, null, 2));
  await prisma.onModuleDestroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
