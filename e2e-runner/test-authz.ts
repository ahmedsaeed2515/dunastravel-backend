import { createCsrfSession, prisma, cleanup } from './setup';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  notes: string;
}

const results: TestResult[] = [];

function pass(name: string, notes: string) {
  results.push({ name, status: 'PASS', notes });
  console.log(`  ✅ PASS: ${name}`);
  if (notes) console.log(`         ${notes}`);
}

function fail(name: string, notes: string) {
  results.push({ name, status: 'FAIL', notes });
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`         ${notes}`);
}

async function runAuthzTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 5 — AUTHORIZATION & SECURITY AUDIT (PART 1)');
  console.log('═══════════════════════════════════════════════════\n');

  // SETUP: Create standard user and guest session
  const guestSess = await createCsrfSession();
  
  const userEmail = `authz_user_${Date.now()}@test.com`;
  const userSess = await createCsrfSession();
  
  console.log('[SETUP] Creating standard user...');
  await userSess.post('/auth/register', { email: userEmail, password: 'Password1!', name: 'Authz User', phone: '+1234567890' });
  const userRec = await prisma.user.findUnique({ where: { email: userEmail } });
  if (userRec?.verifyToken) {
    await userSess.post('/auth/verify-email', { token: userRec.verifyToken });
  }
  await userSess.post('/auth/login', { email: userEmail, password: 'Password1!' });

  // ─────────────────────────────────────────────────────
  // 1. VERTICAL PRIVILEGE ESCALATION
  // ─────────────────────────────────────────────────────
  console.log('\n[1/5] Vertical Privilege Escalation (Mass Assignment)');
  const hackerEmail = `hacker_${Date.now()}@test.com`;
  const hackerRes = await guestSess.post('/auth/register', { 
    email: hackerEmail, 
    password: 'Password1!', 
    name: 'Hacker', 
    phone: '+1234567890',
    role: 'ADMIN', // Injection attempt
    isVip: true,
  });
  
  const hackerRec = await prisma.user.findUnique({ where: { email: hackerEmail } });
  if (!hackerRec) {
    if (hackerRes.status === 400) {
      pass('Privilege Escalation Prevention', 'Strict DTO validation blocked mass assignment attempt completely (400)');
    } else {
      fail('Privilege Escalation', `Failed to register hacker account for unknown reason: ${hackerRes.status}`);
    }
  } else if (hackerRec.role === 'ADMIN' || hackerRec.isVip === true) {
    fail('Privilege Escalation', 'CRITICAL VULNERABILITY: Mass assignment allowed role/isVip elevation');
  } else {
    pass('Privilege Escalation Prevention', 'Mass assignment gracefully ignored system fields (role, isVip remain default)');
  }

  // ─────────────────────────────────────────────────────
  // 2. GUEST -> ADMIN APIS
  // ─────────────────────────────────────────────────────
  console.log('\n[2/5] Guest -> Admin APIs');
  const guestAdminRes = await guestSess.get('/admin/bookings');
  if (guestAdminRes.status === 401 || guestAdminRes.status === 403) {
    pass('Guest to Admin API', 'Properly rejected Guest access to Admin route');
  } else {
    fail('Guest to Admin API', `Expected 401/403, got ${guestAdminRes.status}`);
  }

  // ─────────────────────────────────────────────────────
  // 3. USER -> ADMIN APIS
  // ─────────────────────────────────────────────────────
  console.log('\n[3/5] User -> Admin APIs');
  const userAdminRes = await userSess.get('/admin/bookings');
  if (userAdminRes.status === 403) {
    pass('User to Admin API', 'Properly rejected standard User access to Admin route (403 Forbidden)');
  } else {
    fail('User to Admin API', `Expected 403, got ${userAdminRes.status}`);
  }

  // ─────────────────────────────────────────────────────
  // 4. IDOR: USER -> OTHER USER'S BOOKING (VIA /bookings/me vs /bookings/:ref)
  // ─────────────────────────────────────────────────────
  console.log('\n[4/5] IDOR Testing (Insecure Direct Object Reference)');
  
  // Create an arbitrary booking for testing IDOR
  let tour = await prisma.tour.findFirst();
  if (!tour) {
    tour = await prisma.tour.create({ data: { slug: 'authz-tour', titleJsonb: { en: 'Authz' }, status: 'PUBLISHED', basePriceUsd: 100 } });
  }

  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + 10);
  
  const hackerSess = await createCsrfSession();
  
  // Create hacker account properly without mass assignment to test IDOR
  await hackerSess.post('/auth/register', { email: hackerEmail, password: 'Password1!', name: 'Hacker', phone: '+1234567890' });
  const newHackerRec = await prisma.user.findUnique({ where: { email: hackerEmail } });
  if (newHackerRec?.verifyToken) {
    await hackerSess.post('/auth/verify-email', { token: newHackerRec.verifyToken });
  }
  await hackerSess.post('/auth/login', { email: hackerEmail, password: 'Password1!' });

  // Let "userSess" book a tour
  const bookingPayload = {
    tourId: tour.id,
    arrivalDate: arrivalDate.toISOString().split('T')[0],
    adults: 1,
    passengerNames: [{ passengerType: 'adult', fullName: 'Authz User' }],
    billing: { fullName: 'Authz User', email: userEmail, phone: '+12345678901', invoiceType: 'PERSONAL' }
  };
  const bookRes = await userSess.post('/bookings', bookingPayload);
  const userRef = bookRes.data?.data?.referenceCode;

  if (!userRef) {
    fail('IDOR Prep', 'Failed to create booking for user');
  } else {
    // Now "hackerSess" tries to fetch "userSess"'s booking via /bookings/:ref
    const idorRes = await hackerSess.get(`/bookings/${userRef}`);
    
    if (idorRes.status === 404 || idorRes.status === 403) {
      pass('IDOR on Booking Fetch', 'Hacker session blocked from fetching another user\'s booking');
    } else {
      const data = idorRes.data?.data;
      if (data && data.referenceCode === userRef) {
        fail('IDOR on Booking Fetch', 'CRITICAL: Hacker successfully retrieved another user\'s booking details!');
      } else {
        fail('IDOR on Booking Fetch', `Unexpected response: ${idorRes.status}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────
  console.log('\n[CLEANUP] Removing authz test users and bookings');
  if (userRef) {
    const b = await prisma.booking.findUnique({ where: { referenceCode: userRef }});
    if (b) {
      await prisma.invoice.deleteMany({ where: { bookingId: b.id }});
      await prisma.booking.delete({ where: { id: b.id }});
    }
  }
  await prisma.user.deleteMany({ where: { email: { in: [userEmail, hackerEmail] } } });

  return results;
}

runAuthzTests()
  .then((results) => {
    console.log('\n══════════════ AUTHZ TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    if (failed > 0) process.exit(1);
    console.log('\n  🎉 ALL AUTHZ TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
