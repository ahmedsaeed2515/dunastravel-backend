import { createCsrfSession, prisma, cleanup } from './setup';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  notes: string;
}

const results: TestResult[] = [];

function unwrap(res: any) {
  return res.data?.data || res.data;
}

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

async function runB2BTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 6 — B2B ENTERPRISE ENGINE');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('[SETUP] Creating ADMIN, AGENT users...');
  
  const adminSess = await createCsrfSession();
  const agentSess = await createCsrfSession();

  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('Password1!', 10);
  
  const adminEmail = `admin_b2b_${Date.now()}@test.com`;
  const agentEmail = `agent_b2b_${Date.now()}@test.com`;

  await prisma.user.create({
    data: { email: adminEmail, passwordHash: hash, name: 'Admin', role: 'ADMIN', isVerified: true }
  });
  const agentRec = await prisma.user.create({
    data: { email: agentEmail, passwordHash: hash, name: 'Agent', role: 'AGENT', isVerified: true }
  });

  await adminSess.post('/auth/login', { email: adminEmail, password: 'Password1!' });

  // 1. Create Company
  console.log('\n[1/5] Admin Creates B2B Company');
  const companyPayload = {
    name: 'Luxury Travel Agency',
    companyType: 'AGENCY',
    email: 'contact@luxurytravel.com',
    commissionRate: 15.00
  };
  const compRes = await adminSess.post('/admin/companies', companyPayload);
  let companyId = null;

  if (compRes.status === 201) {
    companyId = compRes.data?.data?.id;
    pass('Company Creation', 'Admin successfully created a B2B company');
  } else {
    fail('Company Creation', `Failed with status ${compRes.status}`);
  }

  // 2. Assign Agent to Company
  if (companyId) {
    console.log('\n[2/5] Assign Agent to Company');
    await prisma.user.update({
      where: { id: agentRec.id },
      data: { companyId }
    });
    pass('Agent Assignment', 'Agent linked to the newly created company');
  } else {
    fail('Agent Assignment', 'Skipped (Company creation failed)');
  }

  await agentSess.post('/auth/login', { email: agentEmail, password: 'Password1!' });

  // 3. Agent Creates Booking
  console.log('\n[3/5] Agent Creates Booking');
  let tour = await prisma.tour.findFirst();
  let bookingRef = null;
  let bookingId = null;

  const bookRes = await agentSess.post('/bookings', {
    tourId: tour!.id,
    arrivalDate: '2026-10-10',
    adults: 2,
    passengerNames: [
      { passengerType: 'adult', fullName: 'Client One' },
      { passengerType: 'adult', fullName: 'Client Two' }
    ],
    billing: { fullName: 'Client One', email: 'client@test.com', phone: '+123456', invoiceType: 'PERSONAL' }
  });

  if (bookRes.status === 201) {
    bookingRef = bookRes.data?.data?.referenceCode;
    bookingId = bookRes.data?.data?.id;
    pass('Agent Booking', 'Agent successfully booked a tour for clients');
  } else {
    fail('Agent Booking', `Failed with status ${bookRes.status}`);
  }

  // 4. Commission Check
  console.log('\n[4/5] Admin Manual Commission Creation');
  if (companyId && bookingId) {
    const commRes = await adminSess.post('/admin/finance/commissions', {
      companyId,
      bookingId,
      rate: 15.00,
      amount: 150.00
    });
    if (commRes.status === 201) {
      pass('Commission Creation', 'Admin successfully created commission record');
      
      const commId = commRes.data?.data?.id;
      // Approve commission
      const appRes = await adminSess.patch(`/admin/finance/commissions/${commId}/status`, {
        status: 'APPROVED'
      });
      if (appRes.status === 200) {
        pass('Commission Approval', 'Admin approved commission, wallet should be credited');
      } else {
        fail('Commission Approval', `Status ${appRes.status}`);
      }
    } else {
      fail('Commission Creation', `Status ${commRes.status}`);
    }
  }

  // 5. Wallet Check
  console.log('\n[5/5] Company Wallet Validation');
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for async wallet processing
  if (companyId) {
    const wallRes = await adminSess.get(`/admin/finance/wallets/COMPANY/${companyId}`);
    if (wallRes.status === 200) {
      const wdata = unwrap(wallRes);
      if (wdata.balance >= 150) {
        pass('Wallet Transaction', 'Wallet balance reflects approved commission');
      } else {
        fail('Wallet Transaction', `Balance is ${wdata.balance}, expected >= 150`);
      }
    } else {
      fail('Wallet Transaction', `Failed to fetch wallet: ${wallRes.status}`);
    }
  }

  // CLEANUP
  console.log('\n[CLEANUP] Removing B2B data');
  if (bookingRef) {
    const b = await prisma.booking.findUnique({ where: { referenceCode: bookingRef } });
    if (b) {
      await prisma.invoice.deleteMany({ where: { bookingId: b.id } });
      await prisma.commission.deleteMany({ where: { bookingId: b.id } });
      await prisma.passenger.deleteMany({ where: { bookingId: b.id } });
      await prisma.billingInfo.deleteMany({ where: { bookingId: b.id } });
      await prisma.booking.delete({ where: { id: b.id } });
    }
  }
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, agentEmail] } } });
  if (companyId) {
    await prisma.walletTransaction.deleteMany({ where: { wallet: { ownerId: companyId } } });
    await prisma.wallet.deleteMany({ where: { ownerId: companyId } });
    await prisma.company.delete({ where: { id: companyId } });
  }

  return results;
}

runB2BTests()
  .then((results) => {
    console.log('\n══════════════ B2B TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    if (failed > 0) process.exit(1);
    console.log('\n  🎉 ALL B2B TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
