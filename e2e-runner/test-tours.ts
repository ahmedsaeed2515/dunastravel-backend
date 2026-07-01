import { createSession, prisma, cleanup } from './setup';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  notes: string;
  dbVerified: boolean;
}

const results: TestResult[] = [];

function pass(name: string, notes: string, dbVerified = false) {
  results.push({ name, status: 'PASS', notes, dbVerified });
  console.log(`  ✅ PASS: ${name}`);
  if (notes) console.log(`         ${notes}`);
}

function fail(name: string, notes: string) {
  results.push({ name, status: 'FAIL', notes, dbVerified: false });
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`         ${notes}`);
}

/**
 * Unwraps the TransformInterceptor envelope: { success, statusCode, data, timestamp }
 * All endpoints except /health return this shape.
 */
function unwrap(axiosResponse: any): any {
  return axiosResponse?.data?.data ?? axiosResponse?.data;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runToursTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 4 — TOURS BUSINESS LOGIC AUDIT');
  console.log('═══════════════════════════════════════════════════\n');

  const sess = createSession();

  // ─────────────────────────────────────────────────────
  // SETUP: Ensure there's a tour in the DB
  // ─────────────────────────────────────────────────────
  let testTour = await prisma.tour.findFirst();
  if (!testTour) {
    testTour = await prisma.tour.create({
      data: {
        slug: 'e2e-test-tour-slug',
        titleJsonb: { en: 'E2E Test Tour' },
        status: 'PUBLISHED',
        basePriceUsd: 1000,
      }
    });
    console.log(`[SETUP] Created test tour: ${testTour.slug}`);
  }

  // ─────────────────────────────────────────────────────
  // TEST 1: LIST TOURS
  // ─────────────────────────────────────────────────────
  console.log('[1/4] List Tours');
  const listRes = await sess.get('/tours');
  if (listRes.status !== 200) {
    fail('List Tours', `Expected 200, got ${listRes.status}`);
  } else {
    const data = unwrap(listRes);
    if (!data.items || !Array.isArray(data.items)) {
      fail('List Tours Data', 'Expected items array in response');
    } else {
      pass('List Tours', 'Successfully retrieved paginated tours list');
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 2: GET TOUR BY SLUG
  // ─────────────────────────────────────────────────────
  console.log('[2/4] Get Tour By Slug');
  const slugRes = await sess.get(`/tours/${testTour.slug}`);
  if (slugRes.status !== 200) {
    fail('Get Tour By Slug', `Expected 200, got ${slugRes.status}`);
  } else {
    const data = unwrap(slugRes);
    if (data.slug !== testTour.slug) {
      fail('Get Tour By Slug Match', `Got slug ${data.slug}, expected ${testTour.slug}`);
    } else {
      pass('Get Tour By Slug', 'Successfully retrieved specific tour details');
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 3: INVALID SLUG (NOT FOUND)
  // ─────────────────────────────────────────────────────
  console.log('[3/4] Invalid Slug (Not Found)');
  const notFoundRes = await sess.get('/tours/invalid-slug-12345');
  if (notFoundRes.status !== 404) {
    fail('Invalid Slug', `Expected 404, got ${notFoundRes.status}`);
  } else {
    pass('Invalid Slug', 'Correctly returned 404 for non-existent tour');
  }

  // ─────────────────────────────────────────────────────
  // TEST 4: LIST TOURS WITH PARAMS
  // ─────────────────────────────────────────────────────
  console.log('[4/4] List Tours With Params');
  const paramRes = await sess.get('/tours?page=1&limit=5');
  if (paramRes.status !== 200) {
    fail('List Tours Params', `Expected 200, got ${paramRes.status}`);
  } else {
    const data = unwrap(paramRes);
    if (data.items && Array.isArray(data.items)) {
      pass('List Tours Params', 'Successfully handled query params');
    } else {
      fail('List Tours Params Data', 'Expected items array in response');
    }
  }

  // ─────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────
  // Don't delete if we just used an existing one. If we created 'e2e-test-tour-slug', delete it.
  if (testTour.slug === 'e2e-test-tour-slug') {
    await prisma.tour.delete({ where: { id: testTour.id } });
    console.log(`\n  [CLEANUP] Removed test tour`);
  }

  return results;
}

runToursTests()
  .then((results) => {
    console.log('\n══════════════ TOURS TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    if (failed > 0) {
      console.log('\n  FAILURES:');
      results.filter(r => r.status === 'FAIL').forEach(r =>
        console.log(`    ✗ ${r.name}: ${r.notes}`)
      );
      process.exit(1);
    }
    console.log('\n  🎉 ALL TOURS TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
