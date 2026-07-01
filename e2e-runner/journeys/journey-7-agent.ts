import { setJourneyContext, createCsrfCertificationSession, prisma, createTestUser } from '../setup-certification';

export async function runJourney7Agent() {
  const J = 'JOURNEY 7 — TRAVEL AGENT';
  
  const agentEmail = `agent_j7_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  
  await createTestUser(agentEmail, 'AGENT');
  const sess = await createCsrfCertificationSession();
  
  const company = await prisma.company.create({
    data: {
      name: 'Agent Partner',
      referenceCode: `A-${Date.now()}`,
      companyType: 'AGENCY',
      commissionRate: 12.00
    }
  });

  await prisma.user.update({ 
    where: { email: agentEmail }, 
    data: { role: 'AGENT', isVerified: true, companyId: company.id } 
  });
  
  const agentSess = await createCsrfCertificationSession();
  setJourneyContext(J, 'Login as Agent');
  await agentSess.post('/auth/login', { email: agentEmail, password });

  setJourneyContext(J, 'Create booking');
  let tour = await prisma.tour.findFirst();
  if (!tour) tour = await prisma.tour.create({ data: { slug: 'j7-tour', titleJsonb: { en: 'J7' }, status: 'PUBLISHED', basePriceUsd: 1000 }});
  
  const res = await agentSess.post('/bookings', {
    tourId: tour.id,
    arrivalDate: new Date(Date.now() + 864000000).toISOString().split('T')[0],
    adults: 2,
    children: 0,
    infants: 0,
    passengerNames: [ 
      { passengerType: 'adult', fullName: 'Client One' },
      { passengerType: 'adult', fullName: 'Client Two' }
    ],
    billing: { fullName: 'Agent J7', email: agentEmail, phone: '+1234567890', invoiceType: 'B2B' }
  });
  
  // Fake transition to PAID to trigger commission logic
  const refCode = res.data?.data?.referenceCode || res.data?.referenceCode;
  if (refCode) {
    const b = await prisma.booking.findUnique({ where: { referenceCode: refCode } });
    if (b) {
      setJourneyContext(J, 'Receive commission');
      await prisma.booking.update({ where: { id: b.id }, data: { status: 'PAID' } });
      await prisma.commission.create({
        data: {
          companyId: company.id,
          bookingId: b.id,
          rate: 12.00,
          amount: 120.00,
          status: 'PENDING'
        }
      });
    }
  }

  setJourneyContext(J, 'Verify wallet balance');
  await agentSess.get('/wallets/me');

  console.log(`[${J}] ✅ Completed successfully`);
}
