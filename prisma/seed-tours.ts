import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const jsonPath = path.join(__dirname, '../../frontend/src/data/programs.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('Programs JSON not found at:', jsonPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const programs = Array.isArray(data) ? data : data.programs;

  console.log(`Starting to seed ${programs.length} tours...`);

  for (const program of programs) {
    // Merge highlights into overview for each language
    const overviewJsonb: any = { ...program.overview };
    if (program.highlights) {
      for (const lang of Object.keys(program.highlights)) {
        if (!overviewJsonb[lang]) overviewJsonb[lang] = '';
        const highlightData = program.highlights[lang];
        const highlightsText = Array.isArray(highlightData) 
          ? highlightData.map((h: string) => `• ${h}`).join('\n')
          : highlightData;
        overviewJsonb[lang] = `${overviewJsonb[lang]}\n\nHighlights:\n${highlightsText}`;
      }
    }

    // Default base price
    const basePriceUsd = 1500.00;

    const tourData = {
      slug: program.slug || program.id.toLowerCase(),
      titleJsonb: program.name || {},
      category: 'CULTURAL',
      basePriceUsd,
      durationJsonb: program.duration || {},
      overviewJsonb,
      minPaxJsonb: program.minPax || {},
      isActive: true,
      capacity: 30,
      country: program.country || program.destination || 'Egypt',
      currency: 'USD',
      transportationJsonb: program.transportOptions || {},
      status: 'PUBLISHED',
      isFeatured: true,
    };

    const tour = await prisma.tour.upsert({
      where: { slug: tourData.slug },
      update: tourData,
      create: tourData,
    });

    // Handle itineraries
    if (program.itinerary && Array.isArray(program.itinerary)) {
      for (let i = 0; i < program.itinerary.length; i++) {
        const day = program.itinerary[i];
        const dayLabel = `Day ${day.day || (i + 1)}`;
        
        await prisma.tourItinerary.deleteMany({
          where: { tourId: tour.id, sortOrder: i + 1 }
        });

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

    // Assign mock image if it doesn't have one
    const imageCount = await prisma.tourImage.count({ where: { tourId: tour.id } });
    if (imageCount === 0) {
      await prisma.tourImage.create({
        data: {
          tourId: tour.id,
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
          isHero: true,
          sortOrder: 1,
        }
      });
    }

    console.log(`Seeded tour: ${tourData.slug}`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
