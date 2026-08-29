import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runAudit() {
  console.log('====================================================');
  console.log('🔬 DUNAS TRAVEL ULTRA FORENSIC AUDIT SUITE');
  console.log('====================================================\n');

  // 1. TOTAL ACTIVE PUBLISHED TOURS
  const totalActive = await prisma.tour.count({
    where: { isActive: true, status: 'PUBLISHED', deletedAt: null }
  });
  console.log(`[DB 2.1] Total Active Published Tours: ${totalActive} (Expected: 59) -> ${totalActive === 59 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 2. EGYPT DIRECT TOURS VIA LANDING PAGE
  const egyptDirectCount = await prisma.tour.count({
    where: {
      isActive: true,
      deletedAt: null,
      landingPages: {
        some: {
          landingPage: { slug: 'egypt' }
        }
      }
    }
  });
  console.log(`[DB 2.1] Egypt Direct Landing Page Tours: ${egyptDirectCount} (Expected: 16) -> ${egyptDirectCount === 16 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 3. MULTI-COUNTRY TOURS VIA LANDING PAGE
  const multiCountryCount = await prisma.tour.count({
    where: {
      isActive: true,
      deletedAt: null,
      landingPages: {
        some: {
          landingPage: { slug: 'multi-country' }
        }
      }
    }
  });
  console.log(`[DB 2.1] Multi-Country Landing Page Tours: ${multiCountryCount} (Expected: 9) -> ${multiCountryCount === 9 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 4. OTHER DESTINATIONS
  const turkeyCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'turkey' } } } }
  });
  console.log(`[DB 2.1] Turkey Tours: ${turkeyCount} (Expected: 15) -> ${turkeyCount === 15 ? 'PASS ✅' : 'FAIL ❌'}`);

  const jordanCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'jordan' } } } }
  });
  console.log(`[DB 2.1] Jordan Tours: ${jordanCount} (Expected: 7) -> ${jordanCount === 7 ? 'PASS ✅' : 'FAIL ❌'}`);

  const dubaiCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'dubai' } } } }
  });
  console.log(`[DB 2.1] Dubai Tours: ${dubaiCount} (Expected: 9) -> ${dubaiCount === 9 ? 'PASS ✅' : 'FAIL ❌'}`);

  const religiousCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'religious' } } } }
  });
  console.log(`[DB 2.1] Religious Tours: ${religiousCount} (Expected: 2) -> ${religiousCount === 2 ? 'PASS ✅' : 'FAIL ❌'}`);

  const moroccoCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'morocco' } } } }
  });
  console.log(`[DB 2.1] Morocco Tours: ${moroccoCount} (Expected: 1) -> ${moroccoCount === 1 ? 'PASS ✅' : 'FAIL ❌'}`);

  const tunisiaCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'tunisia' } } } }
  });
  console.log(`[DB 2.1] Tunisia Tours: ${tunisiaCount} (Expected: 1) -> ${tunisiaCount === 1 ? 'PASS ✅' : 'FAIL ❌'}`);

  const greeceCount = await prisma.tour.count({
    where: { isActive: true, deletedAt: null, landingPages: { some: { landingPage: { slug: 'greece' } } } }
  });
  console.log(`[DB 2.1] Greece Tours: ${greeceCount} (Expected: 1) -> ${greeceCount === 1 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 5. TOURS WITH ZERO DAYS
  const toursWithZeroDays = await prisma.tour.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      itineraries: { none: {} }
    },
    select: { id: true, slug: true }
  });
  console.log(`[DB 2.1] Tours with ZERO Itinerary Days: ${toursWithZeroDays.length} (Expected: 0) -> ${toursWithZeroDays.length === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (toursWithZeroDays.length > 0) {
    console.log('   Gaps:', toursWithZeroDays);
  }

  // 6. TOURS WITH ZERO IMAGES
  const toursWithZeroImages = await prisma.tour.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      images: { none: {} }
    },
    select: { id: true, slug: true }
  });
  console.log(`[DB 2.1] Tours with ZERO Images: ${toursWithZeroImages.length} (Expected: 0) -> ${toursWithZeroImages.length === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (toursWithZeroImages.length > 0) {
    console.log('   Gaps:', toursWithZeroImages);
  }

  // 7. MULTILINGUAL JSONB COMPLETENESS & UNTRANSLATED KEYS AUDIT
  console.log('\n--- Checking 59 Tours Multilingual Completeness (ar, en, es, pt, it) ---');
  const allTours = await prisma.tour.findMany({
    where: { isActive: true, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      itineraries: { orderBy: { sortOrder: 'asc' } },
      landingPages: { include: { landingPage: true } }
    },
    orderBy: { slug: 'asc' }
  });

  const locales = ['ar', 'en', 'es', 'pt', 'it'];
  let jsonbGaps = 0;
  let keyLeaks = 0;

  const keyPattern = /^(tour\.|dest\.|classic\.|honeymooners\.|trip\.|programs\.|completoEgypt\.)/;

  const tourInventory: any[] = [];

  for (const t of allTours) {
    const title = t.titleJsonb as any || {};
    const subtitle = t.subtitleJsonb as any || {};
    const overview = t.overviewJsonb as any || {};
    const duration = t.durationJsonb as any || {};
    const highlights = t.highlightsJsonb as any || {};
    const included = t.includedServicesJsonb as any || {};
    const excluded = t.excludedServicesJsonb as any || {};

    let hasMissingLocale = false;
    let hasRawKey = false;

    // Check title in all 5 locales
    for (const loc of locales) {
      if (!title[loc] || title[loc].trim() === '') {
        hasMissingLocale = true;
      }
      if (typeof title[loc] === 'string' && keyPattern.test(title[loc])) {
        hasRawKey = true;
        keyLeaks++;
      }
      if (typeof overview[loc] === 'string' && keyPattern.test(overview[loc])) {
        hasRawKey = true;
        keyLeaks++;
      }
    }

    if (hasMissingLocale) jsonbGaps++;

    tourInventory.push({
      slug: t.slug,
      country: t.country,
      category: t.category,
      daysCount: t.itineraries.length,
      imagesCount: t.images.length,
      landingPages: t.landingPages.map(lp => lp.landingPage.slug).join(','),
      titleEn: title.en || '',
      titleAr: title.ar || '',
      hasMissingLocale,
      hasRawKey
    });
  }

  console.log(`[DB 2.2] Tours with missing locale in title: ${jsonbGaps} (Expected: 0) -> ${jsonbGaps === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[DB 2.2] Raw unparsed translation key leaks: ${keyLeaks} (Expected: 0) -> ${keyLeaks === 0 ? 'PASS ✅' : 'FAIL ❌'}`);

  // 8. PER-TOUR DAY-BY-DAY ITINERARY VALIDATION (KEY 16 TOURS)
  console.log('\n--- Validating Day Count & Content for Key Tours ---');
  const expectedDays: Record<string, number> = {
    'classic-program': 8,
    'honeymoon-in-egypt': 10,
    'journey-of-the-holy-family-10-days': 10,
    'egypt-jordan-combined-14d': 10, // or 14
    'hurghada-4d3n': 4,
    'sharm-4d3n': 4,
    'siwa-oasis-alexandria': 5,
    'cairo-express-4d': 4,
    'complete-egypt-8d': 8,
    'egito-classico-8d': 8,
    'egito-classico-ii-9d': 9,
    'egito-historico-10d': 10,
    'cairo-cruzeiro-sharm-11d': 11,
    'grande-ramses-10d': 10,
    'tesouros-egipto-9d': 9,
    'estrellas-medio-oriente-19d': 19
  };

  let dayValidationPassed = true;
  for (const [slug, expDays] of Object.entries(expectedDays)) {
    const tour = allTours.find(t => t.slug === slug);
    if (!tour) {
      console.log(`❌ Tour not found in DB: ${slug}`);
      dayValidationPassed = false;
      continue;
    }
    const days = tour.itineraries.length;
    let descriptionsValid = true;
    for (const itin of tour.itineraries) {
      const desc = itin.descriptionJsonb as any;
      if (!desc || !desc.ar || !desc.en) {
        descriptionsValid = false;
      }
    }
    const match = (days === expDays || (slug === 'egypt-jordan-combined-14d' && (days === 10 || days === 14))) && descriptionsValid;
    if (!match) dayValidationPassed = false;
    console.log(`   ${slug.padEnd(36)} -> DB Days: ${days.toString().padStart(2)} (Exp: ${expDays}), Desc AR/EN: ${descriptionsValid ? 'OK' : 'MISSING'} -> ${match ? 'PASS ✅' : 'FAIL ❌'}`);
  }
  console.log(`[DB 2.3] Per-Tour Itinerary Day Validation -> ${dayValidationPassed ? 'PASS ✅' : 'FAIL ❌'}`);

  // 9. GALLERY IMAGES MINIMUM VERIFICATION
  console.log('\n--- Validating Min Image Counts ---');
  const expectedMinImages: Record<string, number> = {
    'classic-program': 4,
    'egypt-jordan-combined-14d': 4,
    'honeymoon-in-egypt': 3,
    'journey-of-the-holy-family-10-days': 3,
    'siwa-oasis-alexandria': 3,
    'hurghada-4d3n': 2,
    'sharm-4d3n': 2,
  };
  let galleryPassed = true;
  for (const [slug, minImgs] of Object.entries(expectedMinImages)) {
    const tour = allTours.find(t => t.slug === slug);
    if (!tour) {
      console.log(`❌ Tour not found: ${slug}`);
      galleryPassed = false;
      continue;
    }
    const actualImgs = tour.images.length;
    const ok = actualImgs >= minImgs;
    if (!ok) galleryPassed = false;
    console.log(`   ${slug.padEnd(36)} -> Images: ${actualImgs} (Min: ${minImgs}) -> ${ok ? 'PASS ✅' : 'FAIL ❌'}`);
  }
  console.log(`[DB 2.4] Gallery Images Validation -> ${galleryPassed ? 'PASS ✅' : 'FAIL ❌'}`);

  // Write out full inventory JSON
  fs.writeFileSync(path.join(__dirname, 'tour_inventory_audit.json'), JSON.stringify(tourInventory, null, 2));
  console.log(`\nInventory JSON saved to: tour_inventory_audit.json`);
}

runAudit().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
