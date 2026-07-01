import { setJourneyContext, createCsrfCertificationSession, prisma, createTestUser } from '../setup-certification';

export async function runJourney6Company() {
  const J = 'JOURNEY 6 — B2B COMPANY';
  
  const compEmail = `comp_j6_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  
  await createTestUser(compEmail, 'COMPANY');
  const sess = await createCsrfCertificationSession();
  
  // Create Company in DB and link user
  const company = await prisma.company.create({
    data: {
      name: 'B2B Partner',
      referenceCode: `C-${Date.now()}`,
      companyType: 'AGENCY',
      status: 'ACTIVE',
      email: compEmail,
      commissionRate: 15.00
    }
  });
  await prisma.user.update({ 
    where: { email: compEmail }, 
    data: { role: 'COMPANY', isVerified: true, companyId: company.id } 
  });
  
  const compSess = await createCsrfCertificationSession();
  setJourneyContext(J, 'Login as Company');
  await compSess.post('/auth/login', { email: compEmail, password });

  setJourneyContext(J, 'View company dashboard');
  await compSess.get('/companies/me');

  setJourneyContext(J, 'View bookings');
  await compSess.get('/bookings/b2b');

  setJourneyContext(J, 'Manage customers');
  await compSess.get('/users?companyId=' + company.id);

  setJourneyContext(J, 'View wallet');
  await compSess.get('/wallets/me');

  setJourneyContext(J, 'View commissions');
  await compSess.get('/commissions');

  setJourneyContext(J, 'Update company profile');
  await compSess.put('/companies/me', { phone: '+123456789' });

  console.log(`[${J}] ✅ Completed successfully`);
}
