import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function checkNonZero() {
  const tours = await prisma.tour.findMany({
    where: {
      deletedAt: null,
      basePriceUsd: { gt: 0 }
    },
    select: {
      slug: true,
      country: true,
      category: true,
      basePriceUsd: true,
      titleJsonb: true,
      seasonPricingJsonb: true,
      hotelInfoJsonb: true
    }
  });

  console.log(`Tours with basePriceUsd > 0: ${tours.length}`);
  for (const t of tours) {
    const title = (t.titleJsonb as any)?.en || t.slug;
    console.log(` - [${t.slug}] Country: ${t.country} | Price: $${t.basePriceUsd} | Title: "${title}"`);
  }
}

checkNonZero().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
