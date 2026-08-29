import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function setEgyptToursPriceZero() {
  console.log('====================================================');
  console.log('🇪🇬 SETTING ALL EGYPT TOURS PRICE TO $0 USD');
  console.log('====================================================\n');

  const egyptSlugs = [
    'cairo-express-4d',
    'cairo-express-alexandria-5d',
    'egito-classico-8d',
    'egito-classico-ii-9d',
    'egito-historico-10d',
    'cairo-cruzeiro-sharm-11d',
    'grande-ramses-10d',
    'tesouros-egipto-9d',
    'complete-egypt-8d',
    'classic-program',
    'honeymoon-in-egypt',
    'journey-of-the-holy-family-10-days',
    'egypt-jordan-combined-14d',
    'hurghada-4d3n',
    'sharm-4d3n',
    'siwa-oasis-alexandria'
  ];

  // 1. Update all Egypt tours basePriceUsd to 0.00
  const updateRes = await prisma.tour.updateMany({
    where: {
      OR: [
        { slug: { in: egyptSlugs } },
        { country: { equals: 'Egypt', mode: 'insensitive' } },
        { country: { equals: 'Egito', mode: 'insensitive' } },
        { country: { equals: 'Egipto', mode: 'insensitive' } },
        {
          landingPages: {
            some: {
              landingPage: {
                slug: 'egypt'
              }
            }
          }
        }
      ]
    },
    data: {
      basePriceUsd: new Prisma.Decimal('0.00')
    }
  });

  console.log(`Successfully updated ${updateRes.count} Egypt tours in PostgreSQL to $0.00 USD!\n`);

  // 2. Fetch and print verified list
  const updatedTours = await prisma.tour.findMany({
    where: {
      OR: [
        { slug: { in: egyptSlugs } },
        { country: { equals: 'Egypt', mode: 'insensitive' } },
        { country: { equals: 'Egito', mode: 'insensitive' } },
        { country: { equals: 'Egipto', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      slug: true,
      titleJsonb: true,
      basePriceUsd: true,
      currency: true,
      country: true
    },
    orderBy: { slug: 'asc' }
  });

  console.log(`Verified ${updatedTours.length} Egypt tours:`);
  for (const t of updatedTours) {
    const title = (t.titleJsonb as any)?.ar || (t.titleJsonb as any)?.en || t.slug;
    console.log(` ✅ [${t.slug}] ${title} -> Price: $${t.basePriceUsd} ${t.currency}`);
  }
}

setEgyptToursPriceZero().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
