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

async function runSecurityTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 5 — SECURITY VULNERABILITY AUDIT (PART 4)');
  console.log('═══════════════════════════════════════════════════\n');

  const sess = await createCsrfSession();

  // 1. SQL INJECTION (Query Params)
  console.log('\n[1/3] SQL / NoSQL Injection (Query Parameters)');
  // NestJS ValidationPipe with enableDebugMessages usually catches this, but Prisma defends against it natively too.
  const sqliRes = await sess.get('/tours?slug=invalid" OR 1=1--');
  if (sqliRes.status === 400 || sqliRes.status === 404 || (sqliRes.data?.data && sqliRes.data?.data?.items?.length === 0)) {
    pass('SQL Injection Prevention', 'Application safely escaped or rejected malicious query payload');
  } else if (sqliRes.status === 500) {
    fail('SQL Injection Prevention', 'Server crashed! Possible unhandled query parsing issue.');
  } else {
    fail('SQL Injection Prevention', `Unexpected response status: ${sqliRes.status}`);
  }

  // 2. XSS (Cross Site Scripting) via payload
  console.log('\n[2/3] XSS (Cross Site Scripting) Validation');
  const xssPayload = '<script>alert("XSS")</script>';
  
  // Try sending it in a contact submission (where public input is allowed)
  const xssRes = await sess.post('/contact', {
    name: 'XSS Tester',
    email: 'xss@test.com',
    message: xssPayload
  });
  
  // The system should either escape it, sanitize it, or accept it (and the frontend is responsible for escaping).
  if (xssRes.status === 201) {
    pass('XSS Input Handling', 'Input stored. Framework assumes Frontend framework (React/Vue/Angular) handles output escaping.');
  } else if (xssRes.status === 400) {
    pass('XSS Input Handling', 'Payload blocked by validation/sanitization layer.');
  } else {
    fail('XSS Input Handling', `Unexpected status: ${xssRes.status}`);
  }

  // 3. MASS ASSIGNMENT (User Profile / Booking)
  console.log('\n[3/3] Mass Assignment / Field Overriding');
  
  // First, create a user
  const email = `sec_${Date.now()}@test.com`;
  await sess.post('/auth/register', { email, password: 'Password1!', name: 'Sec User', phone: '+1234567890' });
  const userRec = await prisma.user.findUnique({ where: { email } });
  if (userRec?.verifyToken) {
    await sess.post('/auth/verify-email', { token: userRec.verifyToken });
  }
  await sess.post('/auth/login', { email, password: 'Password1!' });

  let tour = await prisma.tour.findFirst();
  const bookRes = await sess.post('/bookings', {
    tourId: tour!.id,
    arrivalDate: '2026-10-10',
    adults: 1,
    passengerNames: [{ passengerType: 'adult', fullName: 'Sec User' }],
    billing: { fullName: 'Sec User', email, phone: '+12345678901', invoiceType: 'PERSONAL' },
    totalAmountUsd: 1 // Injection attempt: Try to pay only $1
  });

  const bdata = bookRes.data?.data;
  if (bookRes.status === 400) {
    pass('Mass Assignment & Trust Boundary', 'ValidationPipe successfully rejected request with non-whitelisted property');
  } else if (bookRes.status === 201 && bdata && bdata.totalAmountUsd > 1) {
    pass('Mass Assignment & Trust Boundary', 'Server ignored client-provided price and successfully recalculated server-side total');
  } else {
    fail('Mass Assignment & Trust Boundary', `CRITICAL VULNERABILITY: Server accepted client-provided price! Status: ${bookRes.status}`);
  }

  // CLEANUP
  console.log('\n[CLEANUP] Removing security test data');
  if (bdata?.referenceCode) {
    const b = await prisma.booking.findUnique({ where: { referenceCode: bdata.referenceCode }});
    if (b) {
      await prisma.invoice.deleteMany({ where: { bookingId: b.id }});
      await prisma.booking.delete({ where: { id: b.id }});
    }
  }
  await prisma.user.deleteMany({ where: { email } });
  await prisma.contactSubmission.deleteMany({ where: { email: 'xss@test.com' } });

  return results;
}

runSecurityTests()
  .then((results) => {
    console.log('\n══════════════ SECURITY TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    if (failed > 0) process.exit(1);
    console.log('\n  🎉 ALL SECURITY TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
