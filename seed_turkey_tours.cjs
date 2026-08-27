const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedTurkeyTours() {
  console.log('Connecting to database...');
  const jsonPath = path.join(__dirname, 'prisma/data/turkey-tours.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const programs = Array.isArray(rawData) ? rawData : rawData.programs || [];

  console.log(`Seeding ${programs.length} Turkey tours into database...`);

  // Ensure Turkey landing page exists
  const turkeyDest = await prisma.tourLandingPage.upsert({
    where: { slug: 'turkey' },
    update: {
      titleJsonb: { en: 'Turkey', ar: 'تركيا', es: 'Turquía', pt: 'Turquia', it: 'Turchia' },
      type: 'DESTINATION',
      subtitleJsonb: { en: 'Where East meets West', ar: 'حيث يلتقي الشرق بالغرب' },
      descriptionJsonb: { en: 'From Istanbul to Cappadocia and the Aegean coast', ar: 'من إسطنبول إلى كابادوكيا وساحل بحر إيجة' },
      heroImageUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1920&q=80',
      status: 'PUBLISHED',
      isActive: true,
    },
    create: {
      slug: 'turkey',
      titleJsonb: { en: 'Turkey', ar: 'تركيا', es: 'Turquía', pt: 'Turquia', it: 'Turchia' },
      type: 'DESTINATION',
      subtitleJsonb: { en: 'Where East meets West', ar: 'حيث يلتقي الشرق بالغرب' },
      descriptionJsonb: { en: 'From Istanbul to Cappadocia and the Aegean coast', ar: 'من إسطنبول إلى كابادوكيا وساحل بحر إيجة' },
      heroImageUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1920&q=80',
      status: 'PUBLISHED',
      isActive: true,
    },
  });
  console.log('Ensured Turkey destination exists:', turkeyDest.slug);

  for (const prog of programs) {
    const slug = prog.slug || prog.id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const basePriceUsd = Number(prog.basePriceUsd || prog.price || 999.00);

    const tourData = {
      slug,
      titleJsonb: prog.titleJsonb || prog.name || { en: prog.title || prog.id },
      category: prog.category || 'CULTURAL',
      basePriceUsd,
      durationJsonb: prog.durationJsonb || prog.duration || { en: 'Multiple Days' },
      overviewJsonb: prog.overviewJsonb || prog.overview || { en: '' },
      minPaxJsonb: prog.minPaxJsonb || prog.minPax || { en: '2 Pax' },
      includedServicesJsonb: prog.includedServicesJsonb || prog.includes || {},
      excludedServicesJsonb: prog.excludedServicesJsonb || prog.excludes || {},
      sourceCodeJsonb: prog.sourceCodeJsonb || { en: prog.id },
      highlightsJsonb: prog.highlightsJsonb || prog.highlights || null,
      isActive: true,
      country: 'Turkey',
      currency: 'USD',
      transportationJsonb: prog.transportationJsonb || prog.transportOptions || {},
      status: 'PUBLISHED',
      isFeatured: true,
      languages: ['en', 'ar', 'es', 'pt', 'it'],
    };

    const tour = await prisma.tour.upsert({
      where: { slug: tourData.slug },
      update: tourData,
      create: tourData,
    });

    // Associate tour with Turkey landing page
    await prisma.tourLandingPageTour.upsert({
      where: {
        landingPageId_tourId: {
          landingPageId: turkeyDest.id,
          tourId: tour.id,
        },
      },
      update: {},
      create: {
        landingPageId: turkeyDest.id,
        tourId: tour.id,
      },
    });

    // Handle images
    const imagesList = Array.isArray(prog.images) ? prog.images : (prog.heroImage ? [prog.heroImage] : []);
    if (imagesList.length > 0) {
      await prisma.tourImage.deleteMany({ where: { tourId: tour.id } });
      for (let i = 0; i < imagesList.length; i++) {
        await prisma.tourImage.create({
          data: {
            tourId: tour.id,
            url: imagesList[i],
            sortOrder: i + 1,
            isCover: i === 0,
          },
        });
      }
    }

    // Handle itineraries
    const itineraryList = prog.itinerary || prog.days || [];
    if (Array.isArray(itineraryList) && itineraryList.length > 0) {
      await prisma.tourItinerary.deleteMany({
        where: { tourId: tour.id },
      });

      for (let i = 0; i < itineraryList.length; i++) {
        const day = itineraryList[i];
        const dayLabel = `Day ${day.day || (i + 1)}`;
        await prisma.tourItinerary.create({
          data: {
            tourId: tour.id,
            dayLabel,
            descriptionJsonb: day.description || {},
            mealsJsonb: day.meals || {},
            sortOrder: i + 1,
          },
        });
      }
    }

    console.log(`✅ Seeded Turkey tour: ${tour.slug} (ID: ${tour.id})`);
  }

  console.log('All Turkey tours seeded successfully!');
}

seedTurkeyTours()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
