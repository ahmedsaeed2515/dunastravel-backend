import { createSession, createCsrfSession, prisma, cleanup } from './setup';

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

function unwrap(axiosResponse: any): any {
  return axiosResponse?.data?.data ?? axiosResponse?.data;
}

async function runBookingsTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 4 — BOOKINGS BUSINESS LOGIC AUDIT');
  console.log('═══════════════════════════════════════════════════\n');

  // Ensure there's a tour to book
  let tour = await prisma.tour.findFirst();
  if (!tour) {
    tour = await prisma.tour.create({
      data: {
        slug: 'booking-test-tour',
        titleJsonb: { en: 'Booking Test Tour' },
        status: 'PUBLISHED',
        basePriceUsd: 1500,
      }
    });
    console.log(`[SETUP] Created test tour: ${tour.id}`);
  }

  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + 30); // 30 days in the future
  const formattedDate = arrivalDate.toISOString().split('T')[0];

  const anonymousSess = await createCsrfSession();

  // ─────────────────────────────────────────────────────
  // TEST 1: ANONYMOUS BOOKING CREATION
  // ─────────────────────────────────────────────────────
  console.log('[1/5] Anonymous Booking Creation');
  
  const bookingPayload = {
    tourId: tour.id,
    arrivalDate: formattedDate,
    adults: 2,
    children: 1,
    infants: 0,
    transportChoice: 'flight',
    notes: 'Test anonymous booking',
    passengerNames: [
      { passengerType: 'adult', fullName: 'John Doe' },
      { passengerType: 'adult', fullName: 'Jane Doe' },
      { passengerType: 'child', fullName: 'Jimmy Doe' }
    ],
    billing: {
      fullName: 'John Doe',
      email: 'john.doe.anon@test.com',
      phone: '+12345678901',
      invoiceType: 'PERSONAL',
      address: '123 Test St',
      city: 'Testville',
      country: 'Testland'
    }
  };

  const anonBookingRes = await anonymousSess.post('/bookings', bookingPayload);
  let referenceCode = '';

  if (anonBookingRes.status !== 201) {
    fail('Anonymous Booking', `Expected 201, got ${anonBookingRes.status}: ${JSON.stringify(anonBookingRes.data)}`);
  } else {
    const data = unwrap(anonBookingRes);
    referenceCode = data.referenceCode;
    const dbBooking = await prisma.booking.findUnique({ where: { referenceCode } });
    
    if (!dbBooking) {
      fail('Anonymous Booking DB', 'Booking not found in DB');
    } else if (dbBooking.status !== 'PENDING') {
      fail('Anonymous Booking Status', `Expected PENDING, got ${dbBooking.status}`);
    } else {
      pass('Anonymous Booking Creation', `Booking created successfully: ${referenceCode}`, true);
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 2: ANONYMOUS FETCH BOOKING BY REFERENCE CODE
  // ─────────────────────────────────────────────────────
  console.log('[2/5] Anonymous Fetch Booking');
  if (!referenceCode) {
    fail('Anonymous Fetch', 'Skipping due to missing reference code');
  } else {
    // Requires email parameter for anonymous users
    const fetchRes = await anonymousSess.get(`/bookings/${referenceCode}?email=${bookingPayload.billing.email}`);
    if (fetchRes.status !== 200) {
      fail('Anonymous Fetch', `Expected 200, got ${fetchRes.status}: ${JSON.stringify(fetchRes.data)}`);
    } else {
      const data = unwrap(fetchRes);
      if (data.referenceCode !== referenceCode) {
        fail('Anonymous Fetch Match', `Expected ref ${referenceCode}, got ${data.referenceCode}`);
      } else {
        pass('Anonymous Fetch Booking', 'Successfully retrieved booking by ref + email');
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 3: INVALID EMAIL FETCH BOOKING
  // ─────────────────────────────────────────────────────
  console.log('[3/5] Invalid Email Fetch Booking');
  if (referenceCode) {
    const fetchResBad = await anonymousSess.get(`/bookings/${referenceCode}?email=wrong@test.com`);
    if (fetchResBad.status === 404) {
       pass('Invalid Email Fetch', 'Returned 404 correctly for wrong email');
    } else {
       fail('Invalid Email Fetch', `Expected 404, got ${fetchResBad.status}`);
    }
  } else {
    fail('Invalid Email Fetch', 'Skipping');
  }

  // ─────────────────────────────────────────────────────
  // TEST 4: AUTHENTICATED BOOKING CREATION
  // ─────────────────────────────────────────────────────
  console.log('[4/5] Authenticated Booking Creation');
  
  const testEmail = `e2e_booking_${Date.now()}@test.dunas.io`;
  const testPassword = 'SecurePass123!';
  
  // Register and verify
  const authSess = await createCsrfSession();
  await authSess.post('/auth/register', { email: testEmail, password: testPassword, name: 'Booking Test', phone: '+966000000000' });
  const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
  if (dbUser?.verifyToken) {
    await authSess.post('/auth/verify-email', { token: dbUser.verifyToken });
  }
  await authSess.post('/auth/login', { email: testEmail, password: testPassword });

  // Create booking
  bookingPayload.billing.email = testEmail;
  bookingPayload.notes = 'Test authenticated booking';
  
  const authBookingRes = await authSess.post('/bookings', bookingPayload);
  let authRefCode = '';

  if (authBookingRes.status !== 201) {
    fail('Authenticated Booking', `Expected 201, got ${authBookingRes.status}: ${JSON.stringify(authBookingRes.data)}`);
  } else {
    const data = unwrap(authBookingRes);
    authRefCode = data.referenceCode;
    const dbBooking = await prisma.booking.findUnique({ where: { referenceCode: authRefCode } });
    
    if (!dbBooking) {
      fail('Authenticated Booking DB', 'Booking not found in DB');
    } else if (dbBooking.userId !== dbUser?.id) {
      fail('Authenticated Booking User', 'Booking not linked to user ID in DB');
    } else {
      pass('Authenticated Booking Creation', `Booking created and linked to user ID`, true);
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 5: GET /bookings/me
  // ─────────────────────────────────────────────────────
  console.log('[5/5] Fetch User Bookings (/bookings/me)');
  const meRes = await authSess.get('/bookings/me');
  if (meRes.status !== 200) {
    fail('Fetch User Bookings', `Expected 200, got ${meRes.status}`);
  } else {
    const data = unwrap(meRes);
    if (!Array.isArray(data) || data.length === 0) {
      fail('Fetch User Bookings Array', 'Expected array with at least 1 booking');
    } else {
      const found = data.find((b: any) => b.referenceCode === authRefCode);
      if (found) {
        pass('Fetch User Bookings', 'Successfully retrieved user bookings');
      } else {
        fail('Fetch User Bookings Match', 'Created booking not found in /bookings/me response');
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────
  const b1 = await prisma.booking.findUnique({ where: { referenceCode }});
  if (b1) {
    await prisma.invoice.deleteMany({ where: { bookingId: b1.id }});
    await prisma.booking.delete({ where: { id: b1.id } });
  }
  
  const b2 = await prisma.booking.findUnique({ where: { referenceCode: authRefCode }});
  if (b2) {
    await prisma.invoice.deleteMany({ where: { bookingId: b2.id }});
    await prisma.booking.delete({ where: { id: b2.id } });
  }

  await prisma.user.deleteMany({ where: { email: { contains: 'e2e_booking_' } } });
  if (tour.slug === 'booking-test-tour') await prisma.tour.delete({ where: { id: tour.id } });
  console.log(`\n  [CLEANUP] Removed test bookings, users, and tours`);

  return results;
}

runBookingsTests()
  .then((results) => {
    console.log('\n══════════════ BOOKINGS TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const dbVerified = results.filter(r => r.dbVerified).length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    console.log(`  🗄️  DB Verified : ${dbVerified} assertions`);
    if (failed > 0) {
      console.log('\n  FAILURES:');
      results.filter(r => r.status === 'FAIL').forEach(r =>
        console.log(`    ✗ ${r.name}: ${r.notes}`)
      );
      process.exit(1);
    }
    console.log('\n  🎉 ALL BOOKINGS TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
