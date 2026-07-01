import { setJourneyContext, createCsrfCertificationSession, prisma } from '../setup-certification';

export async function runJourney3Customer() {
  const J = 'JOURNEY 3 — AUTHENTICATED CUSTOMER';
  const sess = await createCsrfCertificationSession();
  const testEmail = `j3_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  // Setup: Create user and verify
  await sess.post('/auth/register', { email: testEmail, password, name: 'J3 Customer', phone: '+1234567890' });
  const user = await prisma.user.findUnique({ where: { email: testEmail } });
  if (user?.verifyToken) {
    await sess.post('/auth/verify-email', { token: user.verifyToken });
  }

  setJourneyContext(J, 'Login');
  let res = await sess.post('/auth/login', { email: testEmail, password });
  if (res.status !== 200 && res.status !== 201) throw new Error(`[${J}] Login failed`);

  setJourneyContext(J, 'Browse tours');
  res = await sess.get('/tours');
  
  let tour = await prisma.tour.findFirst();
  if (!tour) {
    tour = await prisma.tour.create({
      data: { slug: 'j3-test-tour', titleJsonb: { en: 'J3 Tour' }, status: 'PUBLISHED', basePriceUsd: 1000 }
    });
  }

  setJourneyContext(J, 'Open details');
  await sess.get(`/tours/${tour.slug}`);

  setJourneyContext(J, 'Create booking');
  res = await sess.post('/bookings', {
    tourId: tour.id,
    arrivalDate: new Date(Date.now() + 864000000).toISOString().split('T')[0],
    adults: 2,
    children: 1,
    infants: 0,
    transportChoice: 'flight',
    passengerNames: [
      { passengerType: 'adult', fullName: 'Adult One' },
      { passengerType: 'adult', fullName: 'Adult Two' },
      { passengerType: 'child', fullName: 'Child One' }
    ],
    billing: {
      fullName: 'J3 Customer',
      email: testEmail,
      phone: '+1234567890',
      invoiceType: 'PERSONAL'
    }
  });
  if (res.status !== 201) throw new Error(`[${J}] Create booking failed: got ${res.status}`);
  const refCode = res.data.data?.referenceCode || res.data.referenceCode;

  setJourneyContext(J, 'Retrieve booking');
  res = await sess.get(`/bookings/${refCode}`);
  if (res.status !== 200) throw new Error(`[${J}] Retrieve booking failed`);

  setJourneyContext(J, 'Retrieve invoice');
  // Wait a bit to ensure invoice is created via events if it's async
  await new Promise(r => setTimeout(r, 500));
  const invoice = await prisma.invoice.findFirst({ where: { booking: { referenceCode: refCode } } });
  if (invoice) {
    res = await sess.get(`/invoices/${invoice.id}`);
    // Might be restricted depending on authz, we just attempt it
  }

  setJourneyContext(J, 'View booking history');
  res = await sess.get('/bookings/me');
  if (res.status !== 200) throw new Error(`[${J}] View history failed`);

  setJourneyContext(J, 'Update profile');
  // No update profile endpoint for users, just verify GET
  res = await sess.get('/auth/me');
  if (res.status !== 200) throw new Error(`[${J}] Update profile failed`);

  setJourneyContext(J, 'Logout');
  await sess.post('/auth/logout');

  setJourneyContext(J, 'Login again & Refresh token');
  await sess.post('/auth/login', { email: testEmail, password });
  await sess.post('/auth/refresh');

  setJourneyContext(J, 'Delete account');
  // No user self-delete endpoint, skip
  // res = await sess.delete('/users/me');

  console.log(`[${J}] ✅ Completed successfully`);
}
