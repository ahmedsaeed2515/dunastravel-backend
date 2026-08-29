import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

// Exact real prices for all 59 tours
// Egypt tours = $0.00 USD
// All other tours = Exact real prices from legacy project
const EXACT_TOUR_PRICES: Record<string, number> = {
  // --- EGYPT TOURS (24 TOURS -> STRICTLY $0.00 USD) ---
  'cairo-express-4d': 0,
  'cairo-express-alexandria-5d': 0,
  'egito-classico-8d': 0,
  'egito-classico-ii-9d': 0,
  'egito-historico-10d': 0,
  'cairo-cruzeiro-sharm-11d': 0,
  'grande-ramses-10d': 0,
  'tesouros-egipto-9d': 0,
  'complete-egypt-8d': 0,
  'classic-program': 0,
  'honeymoon-in-egypt': 0,
  'journey-of-the-holy-family-10-days': 0,
  'egypt-jordan-combined-14d': 0,
  'hurghada-4d3n': 0,
  'sharm-4d3n': 0,
  'siwa-oasis-alexandria': 0,
  'estrellas-medio-oriente-19d': 0,
  'cairo-and-athens-11-days': 0,
  'essences-of-egypt-and-turkey-15-days': 0,
  'stars-of-the-middle-east-16-days': 0,
  'treasures-of-egypt-and-tunisia-16-days': 0,
  'egypt-and-dubai-13-days': 0,
  'spices-of-egypt-and-morocco': 0,
  'jewels-of-egypt-and-jordan-11-days': 0,

  // --- JORDAN TOURS (7 TOURS -> FROM jordanTours.js) ---
  'reg-15-classic-jordan': 615,
  'reg-16-jordan-with-desert': 670,
  'reg-17-jordan-with-desert-and-dead-sea': 705,
  'reg-18-complete-jordan': 685,
  'reg-19-jordan-red-sea': 665,
  'reg-20-jordan-extension-5-days': 470,
  'reg-21-jordan-extension-4-days': 430,

  // --- DUBAI / UAE TOURS (9 TOURS -> FROM dubaiTours.js) ---
  'reg-22-stop-over-dubai': 165,
  'reg-23-dubai-and-its-history': 245,
  'reg-24-dubai-city-of-the-future': 315,
  'reg-25-dubai-and-abu-dhabi': 409,
  'reg-26-dubai-with-overnight-in-abu-dhabi': 515,
  'reg-27-one-week-in-dubai': 465,
  'reg-28-the-complete-emirates': 799,
  'hm001-honeymoon-in-dubai': 750,
  'hm002-honeymoon-in-dubai-with-dinner-at-burj-al-arab': 1099,

  // --- TURKEY TOURS (15 TOURS -> FROM turkeyTours.js & Turquia.jsx) ---
  'reg-01-legendary-turkey': 1250,
  'reg-03-passion-of-turkey': 950,
  'reg-04-legendary-cappadocia': 990,
  'reg-05-admirable-turkey': 1150,
  'reg-05-b-admirable-turkey-winter': 990,
  'reg-06-heart-of-turkey': 850,
  'reg-07-turkish-riviera': 1390,
  'reg-08-stop-over': 499,
  'reg-09-turkey-without-rush': 1090,
  'reg-10-turkish-riviera-with-fethiye': 1490,
  'reg-11-antalya': 1190,
  'reg-12-beautiful-turkey': 1050,
  'reg-13-extension-7-churches': 450,
  'reg-14-secret-of-the-temple': 1290,
  'ist-01-best-of-istanbul': 599,

  // --- MOROCCO, TUNISIA, GREECE & NON-EGYPT MULTI-COUNTRY ---
  'mrc-01-spices-of-morocco': 799,
  'tunisia-8-days-desert-sea': 1328,
  'lo-mejor-de-grecia-9d': 1490,
  'marvels-of-dubai-and-turkey-14-days': 1750,
};

async function restoreExactPrices() {
  console.log('========================================================================');
  console.log('💰 RESTORING EXACT REAL PRICES (EGYPT = $0, ALL OTHER DESTINATIONS = REAL PRICES)');
  console.log('========================================================================\n');

  let updatedCount = 0;
  for (const [slug, price] of Object.entries(EXACT_TOUR_PRICES)) {
    const tour = await prisma.tour.findFirst({ where: { slug } });
    if (tour) {
      await prisma.tour.update({
        where: { id: tour.id },
        data: {
          basePriceUsd: new Prisma.Decimal(price.toFixed(2)),
          currency: 'USD'
        }
      });
      console.log(` ✅ [${tour.country || 'Global'}] ${slug} -> Price: $${price} USD`);
      updatedCount++;
    } else {
      console.log(` ⚠️ Tour slug not found in DB: ${slug}`);
    }
  }

  console.log(`\n========================================================================`);
  console.log(`🎉 Successfully updated ${updatedCount} / 59 tours with their exact real prices!`);
  console.log(` - Egypt Tours (24 items): Strictly $0.00 USD`);
  console.log(` - Jordan Tours (7 items): $430 - $705 USD`);
  console.log(` - Dubai Tours (9 items): $165 - $1,099 USD`);
  console.log(` - Turkey Tours (15 items): $450 - $1,490 USD`);
  console.log(` - Morocco Tour (1 item): $799 USD`);
  console.log(` - Tunisia Tour (1 item): $1,328 USD`);
  console.log(` - Greece Tour (1 item): $1,490 USD`);
  console.log(` - Dubai & Turkey Tour (1 item): $1,750 USD`);
  console.log(`========================================================================`);
}

restoreExactPrices().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
