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

function unwrap(axiosResponse: any): any {
  return axiosResponse?.data?.data ?? axiosResponse?.data;
}

async function runCrmTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 5 — CRM & ADMIN WORKFLOWS (PART 2)');
  console.log('═══════════════════════════════════════════════════\n');

  const adminEmail = `admin_${Date.now()}@test.com`;
  const adminSess = await createCsrfSession();

  console.log('[SETUP] Creating and elevating ADMIN user...');
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('Password1!', 10);
  const userRec = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hash,
      name: 'Admin User',
      phone: '+1234567890',
      role: 'ADMIN',
      isVerified: true
    }
  });

  await adminSess.post('/auth/login', { email: adminEmail, password: 'Password1!' });

  // Create a booking to manipulate
  let tour = await prisma.tour.findFirst();
  if (!tour) {
    tour = await prisma.tour.create({ data: { slug: 'crm-tour', titleJsonb: { en: 'CRM' }, status: 'PUBLISHED', basePriceUsd: 100 } });
  }

  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + 10);
  const guestSess = await createCsrfSession();
  const bookRes = await guestSess.post('/bookings', {
    tourId: tour.id,
    arrivalDate: arrivalDate.toISOString().split('T')[0],
    adults: 1,
    passengerNames: [{ passengerType: 'adult', fullName: 'Guest User' }],
    billing: { fullName: 'Guest User', email: 'guest@test.com', phone: '+12345678901', invoiceType: 'PERSONAL' }
  });
  const refCode = unwrap(bookRes).referenceCode;

  // ─────────────────────────────────────────────────────
  // 1. ADMIN LIST BOOKINGS
  // ─────────────────────────────────────────────────────
  console.log('\n[1/4] Admin List Bookings');
  const listRes = await adminSess.get('/admin/bookings?page=1&limit=5');
  if (listRes.status !== 200) {
    fail('Admin List Bookings', `Expected 200, got ${listRes.status}`);
  } else {
    const data = unwrap(listRes);
    console.log('DEBUG LIST DATA:', JSON.stringify(data, null, 2));
    if (data.data && Array.isArray(data.data)) {
      pass('Admin List Bookings', 'Admin can view all paginated bookings successfully');
    } else if (data.items && Array.isArray(data.items)) {
      pass('Admin List Bookings', 'Admin can view all paginated bookings successfully (via items)');
    } else if (Array.isArray(data)) {
      pass('Admin List Bookings', 'Admin can view all paginated bookings successfully (via array)');
    } else {
      fail('Admin List Bookings', 'Missing items array (data.data or data.items)');
    }
  }

  // ─────────────────────────────────────────────────────
  // 2. ADMIN UPDATE BOOKING STATUS
  // ─────────────────────────────────────────────────────
  console.log('\n[2/4] Admin Update Booking Status');
  const statusRes = await adminSess.patch(`/admin/bookings/${refCode}/status`, {
    status: 'CONFIRMED'
  });
  if (statusRes.status !== 200) {
    fail('Update Booking Status', `Expected 200, got ${statusRes.status}`);
  } else {
    const data = unwrap(statusRes);
    if (data.status === 'CONFIRMED') {
      pass('Update Booking Status', 'Admin successfully updated booking status');
    } else {
      fail('Update Booking Status', 'Status was not updated in response');
    }
  }

  // ─────────────────────────────────────────────────────
  // 3. ADMIN ADD BOOKING NOTE
  // ─────────────────────────────────────────────────────
  console.log('\n[3/4] Admin Add Booking Note');
  const noteRes = await adminSess.post(`/admin/bookings/${refCode}/notes`, {
    content: 'Verified by CRM audit test'
  });
  if (noteRes.status !== 201 && noteRes.status !== 200) {
    fail('Add Booking Note', `Expected success, got ${noteRes.status}`);
  } else {
    pass('Add Booking Note', 'Successfully appended internal note to booking');
  }

  // ─────────────────────────────────────────────────────
  // 4. ADMIN SOFT DELETE BOOKING
  // ─────────────────────────────────────────────────────
  console.log('\n[4/4] Admin Soft Delete Booking');
  const delRes = await adminSess.delete(`/admin/bookings/${refCode}`);
  if (delRes.status !== 200) {
    fail('Soft Delete Booking', `Expected 200, got ${delRes.status}`);
  } else {
    const dbCheck = await prisma.booking.findUnique({ where: { referenceCode: refCode } });
    if (dbCheck && dbCheck.deletedAt !== null) {
      pass('Soft Delete Booking', 'Booking correctly soft-deleted with timestamp in DB');
    } else {
      fail('Soft Delete Booking', 'DB record does not show deletedAt timestamp');
    }
  }

  // ─────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────
  console.log('\n[CLEANUP] Removing CRM test data');
  const b = await prisma.booking.findUnique({ where: { referenceCode: refCode }});
  if (b) {
    await prisma.invoice.deleteMany({ where: { bookingId: b.id }});
    await prisma.bookingNote.deleteMany({ where: { bookingId: b.id }});
    await prisma.bookingActivityLog.deleteMany({ where: { bookingId: b.id }});
    await prisma.booking.delete({ where: { id: b.id } });
  }
  await prisma.user.deleteMany({ where: { email: adminEmail } });

  return results;
}

runCrmTests()
  .then((results) => {
    console.log('\n══════════════ CRM TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    if (failed > 0) process.exit(1);
    console.log('\n  🎉 ALL CRM TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
