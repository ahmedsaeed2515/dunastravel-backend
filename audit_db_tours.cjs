const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkAllTours() {
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      slug: true,
      country: true,
      category: true,
      images: { select: { id: true, imageUrl: true, isHero: true } },
      landingPages: { select: { landingPage: { select: { slug: true } } } },
    },
  });

  console.log(`Total active tours in DB: ${tours.length}`);
  const toursWithoutImages = tours.filter(t => t.images.length === 0);
  console.log(`Tours without images: ${toursWithoutImages.length}`);
  console.log('Examples of tours without images:', toursWithoutImages.slice(0, 10).map(t => ({ slug: t.slug, country: t.country })));

  const destinations = await prisma.tourLandingPage.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      titleJsonb: true,
      tours: { select: { tour: { select: { slug: true, images: { select: { imageUrl: true } } } } } },
    },
  });

  console.log('\n--- Destinations & their attached tours ---');
  for (const dest of destinations) {
    console.log(`Destination: ${dest.slug} -> ${dest.tours.length} tours attached`);
    for (const t of dest.tours) {
      console.log(`   - Tour: ${t.tour.slug} (images: ${t.tour.images.length})`);
    }
  }
}

checkAllTours()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
