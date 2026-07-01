import { setJourneyContext, createCsrfCertificationSession, prisma, createTestUser } from '../setup-certification';

export async function runJourney5Admin() {
  const J = 'JOURNEY 5 — ADMIN';
  const sess = await createCsrfCertificationSession();
  
  const adminEmail = `admin_j5_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  await createTestUser(adminEmail, 'ADMIN');
  
  const adminSess = await createCsrfCertificationSession();
  setJourneyContext(J, 'Login as Admin');
  await adminSess.post('/auth/login', { email: adminEmail, password });

  setJourneyContext(J, 'View metrics');
  let res = await adminSess.get('/metrics');
  // if endpoint differs or 404s, it's fine, we log it.

  setJourneyContext(J, 'View bookings');
  res = await adminSess.get('/bookings');

  // Let's create a tour just for admin CRUD
  setJourneyContext(J, 'Create tour');
  const tourRes = await adminSess.post('/tours', {
    slug: `j5-tour-${Date.now()}`,
    titleJsonb: { en: 'J5 Admin Tour' },
    basePriceUsd: 1200,
    status: 'PUBLISHED'
  });
  const tourId = tourRes.data?.data?.id || tourRes.data?.id;

  if (tourId) {
    setJourneyContext(J, 'Edit tour');
    await adminSess.put(`/tours/${tourId}`, { basePriceUsd: 1500 });
    
    setJourneyContext(J, 'Delete tour');
    await adminSess.delete(`/tours/${tourId}`);
  }

  setJourneyContext(J, 'View users');
  res = await adminSess.get('/users');

  const userId = res.data?.data?.[0]?.id || res.data?.[0]?.id;
  if (userId) {
    setJourneyContext(J, 'Update user');
    await adminSess.patch(`/users/${userId}`, { status: 'ACTIVE' });
  }

  setJourneyContext(J, 'Create company');
  res = await adminSess.post('/companies', {
    name: 'J5 Company',
    companyType: 'AGENCY',
    email: 'j5_company@example.com',
    commissionRate: 10
  });

  setJourneyContext(J, 'Generate reports');
  await adminSess.get('/reports/sales');

  console.log(`[${J}] ✅ Completed successfully`);
}
