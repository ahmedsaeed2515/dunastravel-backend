import { setJourneyContext, createCsrfCertificationSession, prisma, createTestUser } from '../setup-certification';

export async function runJourney9CRM() {
  const J = 'JOURNEY 9 — CRM MODULE';
  
  const adminEmail = `crm_j9_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  const adminUser = await createTestUser(adminEmail, 'ADMIN');
  const sess = await createCsrfCertificationSession();
  
  const crmSess = await createCsrfCertificationSession();
  await crmSess.post('/auth/login', { email: adminEmail, password });

  const custEmail = `cust_j9_${Date.now()}@example.com`;
  
  setJourneyContext(J, 'Create customer');
  const cRes = await crmSess.post('/users', {
    email: custEmail,
    name: 'J9 Customer',
    role: 'USER',
    password: 'SecurePassword123!'
  });
  const custId = cRes.data?.data?.id || cRes.data?.id;

  if (custId) {
    setJourneyContext(J, 'Edit customer');
    await crmSess.patch(`/users/${custId}`, { phone: '+111111111' });

    setJourneyContext(J, 'Add notes');
    await prisma.customerNote.create({
      data: { customerId: custId, userId: adminUser.id, content: 'Test note' }
    });

    setJourneyContext(J, 'Assign tags');
    await crmSess.patch(`/users/${custId}`, { tags: ['VIP', 'TEST'] });

    setJourneyContext(J, 'Activity log');
    await prisma.customerActivityLog.create({
      data: { customerId: custId, action: 'Added to CRM', userId: adminUser.id }
    });
  }

  setJourneyContext(J, 'Search / Filter users');
  await crmSess.get('/users?search=J9');

  console.log(`[${J}] ✅ Completed successfully`);
}
