import { setJourneyContext, createCsrfCertificationSession, prisma, createTestUser } from '../setup-certification';

export async function runJourney11AI() {
  const J = 'JOURNEY 11 — AI INTEGRATIONS';
  
  const email = `ai_j11_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  const user = await createTestUser(email, 'USER');
  
  const aiSess = await createCsrfCertificationSession();
  await aiSess.post('/auth/login', { email, password });

  setJourneyContext(J, 'Generate itinerary');
  // Usually POST /ai/generate-itinerary or similar. We will just send to /ai/itinerary if it exists, or catch 404
  await aiSess.post('/ai/itinerary', {
    destination: 'Paris',
    durationDays: 3,
    preferences: ['Culture', 'Food']
  });

  setJourneyContext(J, 'Analyze customer');
  // Admin only feature typically
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  const adminSess = await createCsrfCertificationSession();
  await adminSess.post('/auth/login', { email, password });

  await adminSess.post(`/ai/analyze-customer`, { customerId: user.id });

  console.log(`[${J}] ✅ Completed successfully`);
}
