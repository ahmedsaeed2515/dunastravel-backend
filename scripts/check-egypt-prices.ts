import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function checkAllPrices() {
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      country: true,
      city: true,
      category: true,
      basePriceUsd: true,
      titleJsonb: true,
      tags: true,
      landingPages: { select: { landingPage: { select: { slug: true } } } }
    },
    orderBy: { slug: 'asc' }
  });

  console.log(`Total Tours in DB: ${tours.length}\n`);

  console.log('=== ALL TOURS AND CURRENT PRICES ===');
  for (const t of tours) {
    const titleEn = (t.titleJsonb as any)?.en || '';
    const titleAr = (t.titleJsonb as any)?.ar || '';
    const lps = t.landingPages.map((lp: any) => lp.landingPage.slug).join(', ');
    
    // Check if it mentions Egypt anywhere
    const isEgyptRelated = 
      t.country?.toLowerCase().includes('egypt') ||
      t.country?.toLowerCase().includes('egito') ||
      t.country?.toLowerCase().includes('egipto') ||
      t.city?.toLowerCase().includes('cairo') ||
      t.city?.toLowerCase().includes('luxor') ||
      t.city?.toLowerCase().includes('aswan') ||
      t.city?.toLowerCase().includes('hurghada') ||
      t.city?.toLowerCase().includes('sharm') ||
      t.slug.toLowerCase().includes('cairo') ||
      t.slug.toLowerCase().includes('egypt') ||
      t.slug.toLowerCase().includes('egito') ||
      t.slug.toLowerCase().includes('egipto') ||
      t.slug.toLowerCase().includes('nile') ||
      t.slug.toLowerCase().includes('hurghada') ||
      t.slug.toLowerCase().includes('sharm') ||
      t.slug.toLowerCase().includes('siwa') ||
      t.slug.toLowerCase().includes('ramses') ||
      t.slug.toLowerCase().includes('pharaoh') ||
      titleEn.toLowerCase().includes('egypt') ||
      titleEn.toLowerCase().includes('cairo') ||
      titleEn.toLowerCase().includes('nile') ||
      titleEn.toLowerCase().includes('alexandria') ||
      titleAr.includes('مصر') ||
      titleAr.includes('القاهرة') ||
      titleAr.includes('النيل') ||
      titleAr.includes('الإسكندرية') ||
      titleAr.includes('الغردقة') ||
      titleAr.includes('شرم') ||
      titleAr.includes('سيوة') ||
      lps.includes('egypt');

    console.log(`[${t.slug}] Price: $${t.basePriceUsd} | Country: ${t.country} | Egypt-Related: ${isEgyptRelated ? 'YES 🇪🇬' : 'NO'} | Title: "${titleEn}" / "${titleAr}"`);
  }
}

checkAllPrices().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
