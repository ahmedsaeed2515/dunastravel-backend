import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const jsonPath = path.join(__dirname, '../src/data/unified-egypt-tours.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Unified Egypt tours JSON not found at:', jsonPath);
    return;
  }

  const tours = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Starting to seed ${tours.length} Egypt tours to PostgreSQL...`);

  // 1. Ensure Egypt destination landing page exists
  let egyptLandingPage = await prisma.tourLandingPage.findFirst({
    where: { slug: 'egypt' }
  });

  if (!egyptLandingPage) {
    egyptLandingPage = await prisma.tourLandingPage.create({
      data: {
        slug: 'egypt',
        type: 'DESTINATION',
        status: 'PUBLISHED',
        titleJsonb: {
          ar: 'مصر - أرض الفراعنة وسحر التاريخ',
          en: 'Egypt - Land of Pharaohs & Timeless History',
          es: 'Egipto - Tierra de Faraones',
          pt: 'Egito - Terra dos Faraós',
          it: 'Egitto - Terra dei Faraoni',
        },
        subtitleJsonb: {
          ar: 'باقات سياحية فاخرة تشمل الأهرامات، نايل كروز، ورحلات البحر الأحمر',
          en: 'Luxury tour packages covering Pyramids, Nile Cruises, and Red Sea Resorts',
          es: 'Paquetes de lujo con Pirámides, Cruceros por el Nilo y Mar Rojo',
          pt: 'Pacotes de luxo com Pirâmides, Cruzeiros no Nilo e Mar Vermelho',
          it: 'Pacchetti di lusso con Piramidi, Crociere sul Nilo e Mar Rosso',
        },
        heroImageUrl: 'https://images.unsplash.com/photo-1572252821143-035a0f6700c2?q=80&w=1200',
      }
    });
    console.log('Created Egypt Landing Page:', egyptLandingPage.id);
  }

  // 2. Upsert each of the 19 tours
  let sortIdx = 1;
  for (const t of tours) {
    const durationJsonb = {
      ar: t.duration,
      en: t.duration,
      es: t.duration,
      pt: t.duration,
      it: t.duration,
    };

    const tourData = {
      slug: t.slug,
      titleJsonb: t.titleJsonb,
      category: t.type === 'VIP' ? 'VIP' : t.type === 'Adventure' ? 'ADVENTURE' : 'CULTURAL',
      basePriceUsd: Number(t.price) || 990.0,
      durationJsonb,
      overviewJsonb: t.overviewJsonb,
      minPaxJsonb: { en: '2 Pax', ar: 'شخصين' },
      isActive: true,
      capacity: 40,
      country: 'Egypt',
      currency: 'USD',
      status: 'PUBLISHED',
      isFeatured: Boolean(t.popular),
    };

    const tour = await prisma.tour.upsert({
      where: { slug: t.slug },
      update: tourData,
      create: tourData,
    });

    console.log(`[${sortIdx}] Upserted Tour: ${tour.slug} (ID: ${tour.id})`);

    // Link Tour to Egypt Landing Page
    await prisma.tourLandingPageTour.upsert({
      where: {
        landingPageId_tourId: {
          landingPageId: egyptLandingPage.id,
          tourId: tour.id,
        }
      },
      update: {
        sortOrder: sortIdx,
        isFeatured: Boolean(t.popular),
      },
      create: {
        landingPageId: egyptLandingPage.id,
        tourId: tour.id,
        sortOrder: sortIdx,
        isFeatured: Boolean(t.popular),
      }
    });

    // Upsert Hero Image
    if (t.heroImage) {
      await prisma.tourImage.deleteMany({ where: { tourId: tour.id } });
      await prisma.tourImage.create({
        data: {
          tourId: tour.id,
          imageUrl: t.heroImage,
          isHero: true,
          sortOrder: 1,
        }
      });
    }

    // Upsert Itinerary Days
    if (t.itineraryJsonb?.ar && Array.isArray(t.itineraryJsonb.ar)) {
      await prisma.tourItinerary.deleteMany({ where: { tourId: tour.id } });
      for (let dayIdx = 0; dayIdx < t.itineraryJsonb.ar.length; dayIdx++) {
        const arDay = t.itineraryJsonb.ar[dayIdx];
        const enDay = t.itineraryJsonb.en?.[dayIdx] || arDay;
        const esDay = t.itineraryJsonb.es?.[dayIdx] || enDay;
        const ptDay = t.itineraryJsonb.pt?.[dayIdx] || enDay;
        const itDay = t.itineraryJsonb.it?.[dayIdx] || enDay;

        await prisma.tourItinerary.create({
          data: {
            tourId: tour.id,
            dayLabel: `Day ${dayIdx + 1}`,
            sortOrder: dayIdx + 1,
            descriptionJsonb: {
              ar: `${arDay.title}\n${arDay.description}`,
              en: `${enDay.title}\n${enDay.description}`,
              es: `${esDay.title}\n${esDay.description}`,
              pt: `${ptDay.title}\n${ptDay.description}`,
              it: `${itDay.title}\n${itDay.description}`,
            },
            mealsJsonb: { ar: 'الإفطار', en: 'Breakfast' },
          }
        });
      }
    }

    sortIdx++;
  }

  console.log('✅ Successfully seeded all 19 Egypt tours and linked to landing page!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
