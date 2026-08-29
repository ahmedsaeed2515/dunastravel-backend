import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function check() {
  const tours = await prisma.tour.findMany({
    where: {
      OR: [
        { country: { equals: 'Egypt', mode: 'insensitive' } },
        { country: { equals: 'Egito', mode: 'insensitive' } },
        { country: { equals: 'Egipto', mode: 'insensitive' } },
        { slug: { in: [
          'cairo-express-4d', 'cairo-express-alexandria-5d', 'egito-classico-8d',
          'egito-classico-ii-9d', 'egito-historico-10d', 'cairo-cruzeiro-sharm-11d',
          'grande-ramses-10d', 'tesouros-egipto-9d', 'complete-egypt-8d',
          'classic-program', 'honeymoon-in-egypt', 'journey-of-the-holy-family-10-days',
          'egypt-jordan-combined-14d', 'hurghada-4d3n', 'sharm-4d3n', 'siwa-oasis-alexandria',
          'estrellas-medio-oriente-19d', 'cairo-and-athens-11-days', 'essences-of-egypt-and-turkey-15-days',
          'stars-of-the-middle-east-16-days', 'treasures-of-egypt-and-tunisia-16-days',
          'egypt-and-dubai-13-days', 'spices-of-egypt-and-morocco', 'jewels-of-egypt-and-jordan-11-days'
        ] } }
      ]
    },
    select: {
      slug: true,
      country: true,
      basePriceUsd: true,
      seasonPricingJsonb: true
    }
  });

  console.log(`Auditing ${tours.length} Egypt & Egypt Multi-Country tours:`);
  for (const t of tours) {
    console.log(`[${t.slug}] basePriceUsd: $${t.basePriceUsd} | seasonPricing: ${JSON.stringify(t.seasonPricingJsonb)}`);
  }
}

check().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
