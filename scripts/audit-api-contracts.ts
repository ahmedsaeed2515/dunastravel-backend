import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ToursService, canonicalDestinationSlug } from '../src/modules/tours/tours.service';
import { TourLandingPagesService } from '../src/modules/tours/tour-landing-pages.service';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function auditApiContracts() {
  console.log('====================================================');
  console.log('🔬 PHASE 3 — BACKEND API CONTRACT VERIFICATION');
  console.log('====================================================\n');

  const mockCache: any = {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
  };
  const mockCounter: any = { inc: () => {} };
  const mockAudit: any = { log: () => Promise.resolve() };

  const toursService = new ToursService(prisma as any, mockCache, mockCounter);
  const landingPagesService = new TourLandingPagesService(prisma as any, mockAudit);

  let passed = true;

  // 1. GET /api/v1/tours?destination=egypt
  const egyptToursRes = await toursService.findAll({
    destination: 'egypt',
    limit: 100,
    page: 1,
    lang: 'en'
  });
  console.log(`[API 3.1] GET /api/v1/tours?destination=egypt -> Total: ${egyptToursRes.meta.total} (Expected: 16) -> ${egyptToursRes.meta.total === 16 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (egyptToursRes.meta.total !== 16) passed = false;

  // 2. GET /api/v1/tours/classic-program
  try {
    const classicProg = await toursService.findBySlug('classic-program', 'en');
    const daysCount = classicProg.itinerary.length;
    const imgsCount = classicProg.images.length;
    console.log(`[API 3.1] GET /api/v1/tours/classic-program -> Title: "${classicProg.title}", Days: ${daysCount} (Exp: 8), Images: ${imgsCount} (Exp: 4) -> ${(daysCount === 8 && imgsCount === 4) ? 'PASS ✅' : 'FAIL ❌'}`);
    if (daysCount !== 8 || imgsCount !== 4) passed = false;
  } catch (err: any) {
    console.log(`[API 3.1] GET /api/v1/tours/classic-program -> FAIL ❌ (${err.message})`);
    passed = false;
  }

  // 3. GET /api/v1/landing-pages/egypt
  try {
    const egyptLp = await landingPagesService.findOnePublic('egypt', 'en');
    const lpToursCount = egyptLp.tours.length;
    console.log(`[API 3.1] GET /api/v1/landing-pages/egypt -> Attached Tours: ${lpToursCount} (Expected: 16) -> ${lpToursCount === 16 ? 'PASS ✅' : 'FAIL ❌'}`);
    if (lpToursCount !== 16) passed = false;
  } catch (err: any) {
    console.log(`[API 3.1] GET /api/v1/landing-pages/egypt -> FAIL ❌ (${err.message})`);
    passed = false;
  }

  // 4. GET /api/v1/landing-pages/multi-country
  try {
    const multiLp = await landingPagesService.findOnePublic('multi-country', 'en');
    const lpToursCount = multiLp.tours.length;
    console.log(`[API 3.1] GET /api/v1/landing-pages/multi-country -> Attached Tours: ${lpToursCount} (Expected: 9) -> ${lpToursCount === 9 ? 'PASS ✅' : 'FAIL ❌'}`);
    if (lpToursCount !== 9) passed = false;
  } catch (err: any) {
    console.log(`[API 3.1] GET /api/v1/landing-pages/multi-country -> FAIL ❌ (${err.message})`);
    passed = false;
  }

  // 5. GET /api/v1/tours?destination=turkey
  const turkeyRes = await toursService.findAll({ destination: 'turkey', limit: 100, page: 1, lang: 'en' });
  console.log(`[API 3.1] GET /api/v1/tours?destination=turkey -> Total: ${turkeyRes.meta.total} (Expected: 15) -> ${turkeyRes.meta.total === 15 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (turkeyRes.meta.total !== 15) passed = false;

  // 6. GET /api/v1/tours?destination=jordan
  const jordanRes = await toursService.findAll({ destination: 'jordan', limit: 100, page: 1, lang: 'en' });
  console.log(`[API 3.1] GET /api/v1/tours?destination=jordan -> Total: ${jordanRes.meta.total} (Expected: 7) -> ${jordanRes.meta.total === 7 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (jordanRes.meta.total !== 7) passed = false;

  // 7. GET /api/v1/tours?destination=dubai
  const dubaiRes = await toursService.findAll({ destination: 'dubai', limit: 100, page: 1, lang: 'en' });
  console.log(`[API 3.1] GET /api/v1/tours?destination=dubai -> Total: ${dubaiRes.meta.total} (Expected: 9) -> ${dubaiRes.meta.total === 9 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (dubaiRes.meta.total !== 9) passed = false;

  // 8. DATA QUALITY CHECKS
  console.log('\n--- API Data Quality Checks (All 59 Tours) ---');
  const allTours = await prisma.tour.findMany({
    where: { isActive: true, deletedAt: null },
    include: { images: true, itineraries: true }
  });

  let nullTitles = 0;
  let emptyItineraries = 0;
  let invalidUrls = 0;

  for (const t of allTours) {
    const title = t.titleJsonb as any || {};
    if (!title.en || !title.ar) nullTitles++;
    if (t.itineraries.length === 0) emptyItineraries++;
    for (const img of t.images) {
      if (!img.imageUrl || typeof img.imageUrl !== 'string' || img.imageUrl.trim() === '') {
        invalidUrls++;
      }
    }
  }

  console.log(`[API 3.2] Tours with missing en/ar title: ${nullTitles} -> ${nullTitles === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[API 3.2] Tours with empty itineraries: ${emptyItineraries} -> ${emptyItineraries === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`[API 3.2] Invalid image URLs: ${invalidUrls} -> ${invalidUrls === 0 ? 'PASS ✅' : 'FAIL ❌'}`);

  console.log(`\nPHASE 3 OVERALL STATUS: ${passed && nullTitles === 0 && emptyItineraries === 0 && invalidUrls === 0 ? 'PASS ✅ (100% PARITY)' : 'FAIL ❌'}`);
}

auditApiContracts().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
