import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function setEgyptToursPriceZero() {
  console.log('====================================================');
  console.log('🇪🇬 SETTING ALL EGYPT TOURS PRICE TO $0 USD');
  console.log('====================================================\n');

  // Find all tours related to Egypt (by country, slug, or landingPage)
  const egyptTours = await prisma.tour.findMany({
    where: {
      OR: [
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
    select: {
      id: true,
      slug: true,
      titleJsonb: true,
      country: true,
      basePriceUsd: true
    }
  });

  console.log(`Found ${egyptTours.length} Egypt tours to update to $0 USD:`);
  for (const t of egyptTours) {
    const title = (t.titleJsonb as any)?.en || (t.titleJsonb as any)?.ar || t.slug;
    console.log(` - [${t.slug}] "${title}" (Current: $${t.basePriceUsd})`);
  }

  // Update basePriceUsd to 0 for all found Egypt tours
  const updateRes = await prisma.tour.updateMany({
    where: {
      id: { in: egyptTours.map((t: any) => t.id) }
    },
    data: {
      basePriceUsd: new Prisma.Decimal('0.00')
    }
  });

  console.log(`\nSuccessfully updated ${updateRes.count} tours to $0.00 USD!`);

  // Verify
  const verifiedTours = await prisma.tour.findMany({
    where: { id: { in: egyptTours.map((t: any) => t.id) } },
    select: { slug: true, basePriceUsd: true }
  });

  console.log('\n--- VERIFICATION ---');
  for (const t of verifiedTours) {
    console.log(` - ${t.slug} -> basePriceUsd: $${t.basePriceUsd}`);
  }
}

setEgyptToursPriceZero().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
