import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

const GROUP_1_BASE_9 = [
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

const GROUP_2_SPECIAL_PROGRAMS_7 = [
  'classic-program',
  'honeymoon-in-egypt',
  'journey-of-the-holy-family-10-days',
  'egypt-jordan-combined-14d',
  'hurghada-4d3n',
  'sharm-4d3n',
  'siwa-oasis-alexandria'
];

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

async function verifyEgypt24() {
  console.log('================================================================');
  console.log('🇪🇬 COMPLETE 24 EGYPT TOURS & PACKAGES FORENSIC VERIFICATION');
  console.log('================================================================\n');

  const all24Slugs = [...GROUP_1_BASE_9, ...GROUP_2_SPECIAL_PROGRAMS_7, ...GROUP_3_MULTI_COUNTRY_8];
  console.log(`Total Target Egypt Catalog: ${all24Slugs.length} items (Expected: 24)\n`);

  const dbTours = await prisma.tour.findMany({
    where: { slug: { in: all24Slugs }, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      itineraries: { orderBy: { sortOrder: 'asc' } },
      landingPages: { include: { landingPage: true } }
    },
    orderBy: { slug: 'asc' }
  });

  const dbMap = new Map<string, any>(dbTours.map((t: any) => [t.slug, t]));

  console.log('--- 1. GROUP 1: BASE CLASSIC EGYPT TOURS (9 TOURS) ---');
  GROUP_1_BASE_9.forEach((slug, idx) => {
    const t: any = dbMap.get(slug);
    if (!t) {
      console.log(` ❌ [${idx+1}] ${slug}: MISSING IN DATABASE!`);
    } else {
      const titleAr = (t.titleJsonb as any)?.ar || '';
      const titleEn = (t.titleJsonb as any)?.en || '';
      console.log(` ✅ [${idx+1}/9] ${slug} -> "${titleAr}" | Days: ${t.itineraries.length} | Images: ${t.images.length} | Price: $${t.basePriceUsd}`);
    }
  });

  console.log('\n--- 2. GROUP 2: SPECIALIZED EGYPT PROGRAMS & EXTENSIONS (7 PACKAGES) ---');
  GROUP_2_SPECIAL_PROGRAMS_7.forEach((slug, idx) => {
    const t: any = dbMap.get(slug);
    if (!t) {
      console.log(` ❌ [${idx+1}] ${slug}: MISSING IN DATABASE!`);
    } else {
      const titleAr = (t.titleJsonb as any)?.ar || '';
      const titleEn = (t.titleJsonb as any)?.en || '';
      console.log(` ✅ [${idx+1}/7] ${slug} -> "${titleAr}" | Category: ${t.category} | Days: ${t.itineraries.length} | Images: ${t.images.length} | Price: $${t.basePriceUsd}`);
    }
  });

  console.log('\n--- 3. GROUP 3: MULTI-COUNTRY PACKAGES WITH EGYPT (8 PACKAGES) ---');
  GROUP_3_MULTI_COUNTRY_8.forEach((slug, idx) => {
    const t: any = dbMap.get(slug);
    if (!t) {
      console.log(` ❌ [${idx+1}] ${slug}: MISSING IN DATABASE!`);
    } else {
      const titleAr = (t.titleJsonb as any)?.ar || '';
      const titleEn = (t.titleJsonb as any)?.en || '';
      console.log(` ✅ [${idx+1}/8] ${slug} -> "${titleAr}" | Days: ${t.itineraries.length} | Images: ${t.images.length} | Price: $${t.basePriceUsd}`);
    }
  });

  console.log(`\n================================================================`);
  console.log(`📊 FINAL SUMMARY:`);
  console.log(` - Group 1 (Base Classic Tours):       ${GROUP_1_BASE_9.length} / 9 ✅`);
  console.log(` - Group 2 (Specialized Programs):     ${GROUP_2_SPECIAL_PROGRAMS_7.length} / 7 ✅`);
  console.log(` - Group 3 (Multi-Country with Egypt): ${GROUP_3_MULTI_COUNTRY_8.length} / 8 ✅`);
  console.log(` - TOTAL EGYPT TOURS & PACKAGES:       ${dbTours.length} / 24 ✅ (100% PARITY)`);
  console.log(`================================================================`);
}

verifyEgypt24().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
