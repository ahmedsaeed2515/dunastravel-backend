import { setJourneyContext, createCsrfCertificationSession } from '../setup-certification';

export async function runJourney12ErrorHandling() {
  const J = 'JOURNEY 12 — ERROR HANDLING';
  const sess = await createCsrfCertificationSession();
  
  setJourneyContext(J, 'Wrong login');
  let res = await sess.post('/auth/login', { email: 'nonexistent@example.com', password: 'WrongPassword!' });
  if (res.status !== 401 && res.status !== 404 && res.status !== 400) throw new Error(`[${J}] Wrong login didn't return error: ${res.status}`);

  setJourneyContext(J, 'Expired JWT / Refresh token');
  // we just simulate a bad token
  res = await sess.get('/auth/me', { headers: { Authorization: 'Bearer invalid.jwt.token' } });
  if (res.status !== 401) throw new Error(`[${J}] Invalid JWT didn't return 401: ${res.status}`);

  setJourneyContext(J, 'Missing fields');
  res = await sess.post('/auth/register', { email: 'missing-pass@test.com' });
  if (res.status !== 400) throw new Error(`[${J}] Missing fields didn't return 400: ${res.status}`);

  setJourneyContext(J, 'Invalid booking');
  res = await sess.post('/bookings', { tourId: 'invalid-id' });
  if (res.status !== 400 && res.status !== 404) throw new Error(`[${J}] Invalid booking didn't return 400/404: ${res.status}`);

  setJourneyContext(J, 'Unauthorized admin access');
  // using anonymous session
  res = await sess.get('/admin/users');
  if (res.status !== 401 && res.status !== 403) throw new Error(`[${J}] Unauthorized admin didn't return 401/403: ${res.status}`);

  console.log(`[${J}] ✅ Completed successfully`);
}
