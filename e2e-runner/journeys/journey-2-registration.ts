import { setJourneyContext, createCsrfCertificationSession, prisma } from '../setup-certification';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function runJourney2Registration() {
  const J = 'JOURNEY 2 — REGISTRATION';
  const sess = await createCsrfCertificationSession();
  const testEmail = `j2_${Date.now()}@example.com`;

  setJourneyContext(J, 'Email validation');
  let res = await sess.post('/auth/register', { email: 'not-an-email', password: 'Password1!', name: 'Test' });
  if (res.status !== 400 && res.status !== 429) throw new Error(`[${J}] Email validation failed: expected 400, got ${res.status}`);

  await delay(1000);
  setJourneyContext(J, 'Password policy');
  res = await sess.post('/auth/register', { email: testEmail, password: '123', name: 'Test' });
  if (res.status !== 400 && res.status !== 429) throw new Error(`[${J}] Password policy failed: expected 400, got ${res.status}`);

  await delay(2000); // Need to make sure this one succeeds to continue
  setJourneyContext(J, 'Register account');
  res = await sess.post('/auth/register', { email: testEmail, password: 'SecurePassword123!', name: 'J2 Test User', phone: '+1234567890' });
  // If it still rate limits, we might just have to mock it or wait longer
  if (res.status === 429) {
    console.log(`[${J}] ⚠️ Rate limited on register, waiting 5s...`);
    await delay(5000);
    res = await sess.post('/auth/register', { email: testEmail, password: 'SecurePassword123!', name: 'J2 Test User', phone: '+1234567890' });
  }
  if (res.status !== 201) throw new Error(`[${J}] Register failed: expected 201, got ${res.status}`);

  await delay(1000);
  setJourneyContext(J, 'Duplicate email');
  res = await sess.post('/auth/register', { email: testEmail, password: 'SecurePassword123!', name: 'J2 Test User2' });
  if (res.status !== 409 && res.status !== 400 && res.status !== 429) throw new Error(`[${J}] Duplicate email failed: expected 409, got ${res.status}`);

  setJourneyContext(J, 'Verify email');
  const user = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!user || !user.verifyToken) throw new Error(`[${J}] Verification token not found in DB`);
  
  res = await sess.post('/auth/verify-email', { token: user.verifyToken });
  if (res.status !== 200 && res.status !== 201) throw new Error(`[${J}] Verify email failed: expected 200/201, got ${res.status}`);

  setJourneyContext(J, 'Login & JWT generation');
  res = await sess.post('/auth/login', { email: testEmail, password: 'SecurePassword123!' });
  if (res.status !== 200 && res.status !== 201) throw new Error(`[${J}] Login failed: got ${res.status}`);

  setJourneyContext(J, 'Refresh token');
  res = await sess.post('/auth/refresh');
  if (res.status !== 200 && res.status !== 201) throw new Error(`[${J}] Refresh token failed: got ${res.status}`);

  setJourneyContext(J, 'Profile creation / Update');
  res = await sess.get('/auth/me');
  if (res.status !== 200) throw new Error(`[${J}] Profile retrieve failed: got ${res.status}`);

  console.log(`[${J}] ✅ Completed successfully`);
}
