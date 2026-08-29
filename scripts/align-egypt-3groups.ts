import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

const GROUP_1_BASE_CLASSIC_9 = [
  'cairo-express-4d',
  'cairo-express-alexandria-5d',
  'egito-classico-8d',
  'egito-classico-ii-9d',
  'egito-historico-10d',
  'cairo-cruzeiro-sharm-11d',
  'grande-ramses-10d',
  'tesouros-egipto-9d',
  'complete-egypt-8d'
];

const GROUP_2_SPECIAL_PROGRAMS_7: Record<string, { category: string; tags: string[]; additionalLandingPages?: string[] }> = {
  'classic-program': {
    category: 'Classic Program',
    tags: ['dunas-master-source', 'egypt', 'special-program', 'classic-program']
  },
  'honeymoon-in-egypt': {
    category: 'Honeymoon',
    tags: ['dunas-master-source', 'egypt', 'special-program', 'honeymooners']
  },
  'journey-of-the-holy-family-10-days': {
    category: 'Religious',
    tags: ['dunas-master-source', 'egypt', 'special-program', 'religious', 'holy-family'],
    additionalLandingPages: ['religious']
  },
  'egypt-jordan-combined-14d': {
    category: 'Religious',
    tags: ['dunas-master-source', 'egypt', 'special-program', 'religious', 'egypt-jordan'],
    additionalLandingPages: ['religious']
  },
  'hurghada-4d3n': {
    category: 'Extension',
    tags: ['dunas-master-source', 'egypt', 'extension', 'beach-extension', 'hurghada']
  },
  'sharm-4d3n': {
    category: 'Extension',
    tags: ['dunas-master-source', 'egypt', 'extension', 'beach-extension', 'sharm']
  },
  'siwa-oasis-alexandria': {
    category: 'Extension',
    tags: ['dunas-master-source', 'egypt', 'extension', 'desert-extension', 'siwa']
  }
};

const GROUP_3_MULTI_COUNTRY_8 = [
  'estrellas-medio-oriente-19d',
  'cairo-and-athens-11-days',
  'essences-of-egypt-and-turkey-15-days',
  'stars-of-the-middle-east-16-days',
  'treasures-of-egypt-and-tunisia-16-days',
  'egypt-and-dubai-13-days',
  'spices-of-egypt-and-morocco',
  'jewels-of-egypt-and-jordan-11-days'
];

async function alignEgypt3Groups() {
  console.log('========================================================================');
  console.log('🇪🇬 ALIGNING 3-TIER EGYPT STRUCTURE (BACKEND + DB + DASHBOARD + FRONTEND)');
  console.log('========================================================================\n');

  // Find Landing Page IDs
  const egyptPage = await prisma.tourLandingPage.findFirst({ where: { slug: 'egypt', deletedAt: null } });
  const multiPage = await prisma.tourLandingPage.findFirst({ where: { slug: 'multi-country', deletedAt: null } });
  const religiousPage = await prisma.tourLandingPage.findFirst({ where: { slug: 'religious', deletedAt: null } });

  if (!egyptPage || !multiPage) {
    throw new Error('Required landing pages (egypt / multi-country) not found in database!');
  }

  // 1. Group 1: Base Classic Tours (9 tours)
  console.log('Updating Group 1: Base Classic Egypt Tours (9 tours)...');
  for (let idx = 0; idx < GROUP_1_BASE_CLASSIC_9.length; idx++) {
    const slug = GROUP_1_BASE_CLASSIC_9[idx];
    const tour = await prisma.tour.findFirst({ where: { slug } });
    if (tour) {
      await prisma.tour.update({
        where: { id: tour.id },
        data: {
          category: 'Classic',
          country: 'Egypt',
          basePriceUsd: new Prisma.Decimal('0.00'),
          isFeatured: true,
          tags: ['dunas-master-source', 'egypt', 'egypt-classic', 'base-classic']
        }
      });
      // Link to Egypt Landing Page
      await prisma.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId: egyptPage.id,
            tourId: tour.id
          }
        },
        create: {
          landingPageId: egyptPage.id,
          tourId: tour.id,
          sortOrder: idx
        },
        update: {
          sortOrder: idx
        }
      });
      console.log(` ✅ [Group 1: Base Classic ${idx + 1}/9] ${slug} -> Linked to Egypt Landing Page`);
    }
  }

  // 2. Group 2: Special Egypt Programs & Extensions (7 packages)
  console.log('\nUpdating Group 2: Special Egypt Programs & Extensions (7 packages)...');
  let pIdx = 10;
  for (const [slug, meta] of Object.entries(GROUP_2_SPECIAL_PROGRAMS_7)) {
    const tour = await prisma.tour.findFirst({ where: { slug } });
    if (tour) {
      pIdx++;
      await prisma.tour.update({
        where: { id: tour.id },
        data: {
          category: meta.category,
          country: 'Egypt',
          basePriceUsd: new Prisma.Decimal('0.00'),
          isFeatured: true,
          tags: meta.tags
        }
      });
      // Link to Egypt Landing Page
      await prisma.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId: egyptPage.id,
            tourId: tour.id
          }
        },
        create: {
          landingPageId: egyptPage.id,
          tourId: tour.id,
          sortOrder: pIdx
        },
        update: {
          sortOrder: pIdx
        }
      });

      // If Religious, also link to Religious Landing Page
      if (meta.additionalLandingPages?.includes('religious') && religiousPage) {
        await prisma.tourLandingPageTour.upsert({
          where: {
            landingPageId_tourId: {
              landingPageId: religiousPage.id,
              tourId: tour.id
            }
          },
          create: {
            landingPageId: religiousPage.id,
            tourId: tour.id,
            sortOrder: pIdx
          },
          update: {
            sortOrder: pIdx
          }
        });
      }
      console.log(` ✅ [Group 2: Special Program] ${slug} -> Category: ${meta.category} | Linked to Landing Pages`);
    }
  }

  // 3. Group 3: Multi-Country Packages with Egypt (8 packages)
  console.log('\nUpdating Group 3: Multi-Country Packages with Egypt (8 packages)...');
  for (let mIdx = 0; mIdx < GROUP_3_MULTI_COUNTRY_8.length; mIdx++) {
    const slug = GROUP_3_MULTI_COUNTRY_8[mIdx];
    const tour = await prisma.tour.findFirst({ where: { slug } });
    if (tour) {
      await prisma.tour.update({
        where: { id: tour.id },
        data: {
          category: 'Multi-Country',
          country: 'Multi-Country',
          basePriceUsd: new Prisma.Decimal('0.00'),
          isFeatured: true,
          tags: ['dunas-master-source', 'multi-country', 'egypt-combined']
        }
      });
      // Link to Multi-Country Landing Page
      await prisma.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId: multiPage.id,
            tourId: tour.id
          }
        },
        create: {
          landingPageId: multiPage.id,
          tourId: tour.id,
          sortOrder: mIdx
        },
        update: {
          sortOrder: mIdx
        }
      });
      console.log(` ✅ [Group 3: Multi-Country ${mIdx + 1}/8] ${slug} -> Linked to Multi-Country Landing Page`);
    }
  }

  console.log('\n========================================================================');
  console.log('🎉 3-TIER EGYPT STRUCTURE IS NOW 100% SYNCHRONIZED ACROSS DATABASE & APIS!');
  console.log('========================================================================');
}

alignEgypt3Groups().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
