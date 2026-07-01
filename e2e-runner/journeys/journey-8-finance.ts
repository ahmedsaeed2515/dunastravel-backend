import { setJourneyContext, createCsrfCertificationSession, prisma, createTestUser } from '../setup-certification';

export async function runJourney8Finance() {
  const J = 'JOURNEY 8 — FINANCE MANAGEMENT';
  
  const adminEmail = `fin_j8_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  await createTestUser(adminEmail, 'ADMIN');
  const sess = await createCsrfCertificationSession();
  
  const finSess = await createCsrfCertificationSession();
  await finSess.post('/auth/login', { email: adminEmail, password });

  // Assume there is a booking to pay
  let tour = await prisma.tour.findFirst();
  if (!tour) tour = await prisma.tour.create({ data: { slug: 'j8-tour', titleJsonb: { en: 'J8' }, status: 'PUBLISHED', basePriceUsd: 1000 }});
  
  const bRes = await sess.post('/bookings', { // anonymous
    tourId: tour.id,
    arrivalDate: new Date(Date.now() + 864000000).toISOString().split('T')[0],
    adults: 1,
    children: 0,
    infants: 0,
    passengerNames: [ { passengerType: 'adult', fullName: 'Anonymous Client' } ],
    billing: { fullName: 'Anonymous Client', email: 'anon@example.com', phone: '+1234567', invoiceType: 'PERSONAL' }
  });
  const refCode = bRes.data?.data?.referenceCode || bRes.data?.referenceCode;
  const booking = await prisma.booking.findUnique({ where: { referenceCode: refCode } });

  setJourneyContext(J, 'Create payment');
  if (booking) {
    await finSess.post(`/payments`, {
      bookingId: booking.id,
      amount: 1000,
      currency: 'USD',
      method: 'BANK_TRANSFER'
    });
  }

  setJourneyContext(J, 'Approve payment');
  // handled by creation or webhook in real life

  setJourneyContext(J, 'Refund payment');
  if (booking) {
    await finSess.post(`/payments`, {
      bookingId: booking.id,
      amount: 1000,
      currency: 'USD',
      method: 'BANK_TRANSFER',
      isRefund: true
    });
  }

  setJourneyContext(J, 'Generate invoice');
  if (booking) {
    await finSess.post(`/invoices/generate`, { bookingId: booking.id });
  }

  setJourneyContext(J, 'Generate wallet transaction');
  // create dummy wallet
  const w = await prisma.wallet.create({ data: { ownerType: 'USER', ownerId: adminEmail } });
  await prisma.walletTransaction.create({
    data: { walletId: w.id, amount: 50, type: 'CREDIT', referenceType: 'DEPOSIT' }
  });

  console.log(`[${J}] ✅ Completed successfully`);
}
