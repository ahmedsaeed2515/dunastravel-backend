import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Cleaning up Egypt tours and landing page links from database...');

  // 1. Detach all tours from the 'egypt' landing page
  const egyptLp = await prisma.tourLandingPage.findUnique({ where: { slug: 'egypt' } });
  if (egyptLp) {
    const deletedLinks = await prisma.tourLandingPageTour.deleteMany({
      where: { landingPageId: egyptLp.id },
    });
    console.log(`Removed ${deletedLinks.count} tour links from Egypt landing page.`);
  }

  // 2. Find all Egypt tours
  const egyptTours = await prisma.tour.findMany({
    where: {
      OR: [
        { country: { contains: 'Egypt', mode: 'insensitive' } },
        { country: { contains: 'مصر', mode: 'insensitive' } },
        { slug: { contains: 'egypt', mode: 'insensitive' } },
        { slug: { contains: 'cairo', mode: 'insensitive' } },
      ],
    },
  });

  console.log(`Found ${egyptTours.length} Egypt tours to remove.`);

  for (const tour of egyptTours) {
    // Delete itineraries
    await prisma.tourItinerary.deleteMany({ where: { tourId: tour.id } });
    // Delete landing page links
    await prisma.tourLandingPageTour.deleteMany({ where: { tourId: tour.id } });
    // Delete images
    await prisma.tourImage.deleteMany({ where: { tourId: tour.id } });
    // Delete tour
    await prisma.tour.delete({ where: { id: tour.id } });
    console.log(`Deleted Egypt tour: ${tour.slug} (${tour.id})`);
  }

  console.log('Egypt tours database cleanup finished successfully!');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
