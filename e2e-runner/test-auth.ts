import { createSession, prisma, cleanup } from './setup';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  notes: string;
  dbVerified: boolean;
}

/**
 * Unwraps the TransformInterceptor envelope: { success, statusCode, data, timestamp }
 * All endpoints except /health return this shape.
 */
function unwrap(axiosResponse: any): any {
  return axiosResponse?.data?.data ?? axiosResponse?.data;
}

const results: TestResult[] = [];

function pass(name: string, notes: string, dbVerified = false) {
  results.push({ name, status: 'PASS', notes, dbVerified });
  console.log(`  ✅ PASS: ${name}`);
  if (notes) console.log(`         ${notes}`);
}

function fail(name: string, notes: string) {
  results.push({ name, status: 'FAIL', notes, dbVerified: false });
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`         ${notes}`);
}

/** Small delay to respect throttle windows */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runAuthTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   PHASE 4 — AUTHENTICATION BUSINESS LOGIC AUDIT');
  console.log('═══════════════════════════════════════════════════\n');

  const testEmail = `e2e_auth_${Date.now()}@test.dunas.io`;
  const testPassword = 'SecurePass123!';
  
  // ── Single session for the whole auth flow ──
  // We prime the CSRF token once and reuse it. Each sub-test that needs
  // an independent session will clone the cookie store via createSession().
  const mainSess = createSession();
  // Bootstrap CSRF (1 request — not throttled since /auth/csrf is GET)
  await mainSess.get('/auth/csrf');

  // ─────────────────────────────────────────────────────
  // TEST 1: REGISTRATION
  // ─────────────────────────────────────────────────────
  console.log('[1/12] Registration');
  const registerRes = await mainSess.post('/auth/register', {
    email: testEmail,
    password: testPassword,
    name: 'E2E Test User',
    phone: '+9661234567890',
  });

  if (registerRes.status !== 201) {
    fail('Registration', `Expected 201, got ${registerRes.status}: ${JSON.stringify(registerRes.data)}`);
  } else {
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!dbUser) fail('Registration DB', 'User not found in DB');
    else if (dbUser.isVerified !== false) fail('Registration isVerified', 'Must start as false');
    else if (!dbUser.verifyToken) fail('Registration verifyToken', 'verifyToken not generated');
    else if (dbUser.passwordHash === testPassword) fail('Registration Password', '🚨 CRITICAL: Password stored as plaintext!');
    else pass('Registration', `User created. passwordHash set. verifyToken=${dbUser.verifyToken.substring(0,10)}...`, true);
  }

  // ─────────────────────────────────────────────────────
  // TEST 2: DUPLICATE REGISTRATION PREVENTION
  // ─────────────────────────────────────────────────────
  console.log('[2/12] Duplicate Registration Prevention');
  await delay(500);
  const dupRes = await mainSess.post('/auth/register', { email: testEmail, password: testPassword, name: 'Dup' });
  dupRes.status === 409
    ? pass('Duplicate Registration', '409 Conflict for duplicate email')
    : fail('Duplicate Registration', `Expected 409, got ${dupRes.status}`);

  // ─────────────────────────────────────────────────────
  // TEST 3: LOGIN BEFORE VERIFICATION (must fail 401)
  // ─────────────────────────────────────────────────────
  console.log('[3/12] Login Before Email Verification Guard');
  await delay(500);
  const earlyLoginRes = await mainSess.post('/auth/login', { email: testEmail, password: testPassword });
  earlyLoginRes.status === 401
    ? pass('Login Before Verification', 'Correctly blocks unverified users with 401')
    : fail('Login Before Verification', `Expected 401, got ${earlyLoginRes.status}`);

  // ─────────────────────────────────────────────────────
  // TEST 4: EMAIL VERIFICATION
  // ─────────────────────────────────────────────────────
  console.log('[4/12] Email Verification');
  const dbUserPreVerify = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!dbUserPreVerify?.verifyToken) {
    fail('Email Verification', 'Cannot test — verifyToken missing from DB');
  } else {
    const verifyRes = await mainSess.post('/auth/verify-email', { token: dbUserPreVerify.verifyToken });
    if (verifyRes.status !== 200) {
      fail('Email Verification', `Expected 200, got ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);
    } else {
      const dbAfter = await prisma.user.findUnique({ where: { email: testEmail } });
      if (dbAfter?.isVerified !== true) fail('Email Verification DB', 'isVerified must be true');
      else if (dbAfter?.verifyToken !== null) fail('Email Verification Token', 'verifyToken must be null after verification');
      else pass('Email Verification', 'isVerified=true, verifyToken=null confirmed in DB', true);
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 5: INVALID VERIFICATION TOKEN (must fail 400)
  // ─────────────────────────────────────────────────────
  console.log('[5/12] Invalid Verification Token');
  const badVerifyRes = await mainSess.post('/auth/verify-email', { token: 'INVALID_TOKEN_xxxxxxxx' });
  badVerifyRes.status === 400
    ? pass('Invalid Verification Token', '400 Bad Request for invalid token')
    : fail('Invalid Verification Token', `Expected 400, got ${badVerifyRes.status}`);

  // ─────────────────────────────────────────────────────
  // TEST 6: LOGIN WITH CORRECT CREDENTIALS
  // ─────────────────────────────────────────────────────
  console.log('[6/12] Login (Correct Credentials)');
  // Throttle: we've made 4 auth requests, wait to be safe
  await delay(13000);
  const loginRes = await mainSess.post('/auth/login', { email: testEmail, password: testPassword });
  if (loginRes.status !== 200) {
    fail('Login', `Expected 200, got ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  } else {
    const dbAfterLogin = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!dbAfterLogin?.refreshToken) fail('Login DB', 'refreshToken hash not stored in DB');
    else pass('Login', 'access_token cookie set, refreshToken hash stored in DB', true);
  }

  // ─────────────────────────────────────────────────────
  // TEST 7: /auth/me — AUTHENTICATED SESSION
  // ─────────────────────────────────────────────────────
  console.log('[7/12] Authenticated /auth/me');
  const meRes = await mainSess.get('/auth/me');
  const meUser = unwrap(meRes);
  console.log(`       Status: ${meRes.status} | email: ${meUser?.email}`);
  if (meRes.status !== 200) {
    fail('/auth/me', `Expected 200, got ${meRes.status}: ${JSON.stringify(meRes.data)}`);
  } else if (meUser?.email !== testEmail) {
    fail('/auth/me Email Match', `Got '${meUser?.email}', expected '${testEmail}'. Full body: ${JSON.stringify(meRes.data)}`);
  } else {
    pass('/auth/me', `Returns correct profile: email=${meUser.email}, role=${meUser.role}`);
  }

  // ─────────────────────────────────────────────────────
  // TEST 8: LOGIN WITH WRONG PASSWORD (must fail 401)
  // ─────────────────────────────────────────────────────
  console.log('[8/12] Login With Wrong Password');
  await delay(500);
  const wrongPassRes = await mainSess.post('/auth/login', { email: testEmail, password: 'WrongPassword999!' });
  wrongPassRes.status === 401
    ? pass('Wrong Password Rejection', '401 Unauthorized for wrong password')
    : fail('Wrong Password Rejection', `Expected 401, got ${wrongPassRes.status}`);

  // ─────────────────────────────────────────────────────
  // TEST 9: TOKEN REFRESH
  // ─────────────────────────────────────────────────────
  console.log('[9/12] Token Refresh');
  const refreshRes = await mainSess.post('/auth/refresh');
  refreshRes.status === 200
    ? pass('Token Refresh', 'Valid refresh_token cookie accepted, new tokens issued')
    : fail('Token Refresh', `Expected 200, got ${refreshRes.status}: ${JSON.stringify(refreshRes.data)}`);

  // ─────────────────────────────────────────────────────
  // TEST 10: FORGOT PASSWORD
  // ─────────────────────────────────────────────────────
  console.log('[10/12] Forgot Password');
  await delay(13000); // throttle window reset
  const forgotRes = await mainSess.post('/auth/forgot-password', { email: testEmail });
  if (forgotRes.status !== 200) {
    fail('Forgot Password', `Expected 200, got ${forgotRes.status}`);
  } else {
    const dbForgot = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!dbForgot?.resetToken || !dbForgot?.resetTokenExp) {
      fail('Forgot Password DB', 'resetToken or resetTokenExp not set in DB');
    } else {
      pass('Forgot Password', 'resetToken + resetTokenExp stored in DB', true);
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 11: RESET PASSWORD
  // ─────────────────────────────────────────────────────
  console.log('[11/12] Reset Password');
  const dbBeforeReset = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!dbBeforeReset?.resetToken) {
    fail('Reset Password', 'Cannot test — no resetToken in DB');
  } else {
    const newPassword = 'NewSecure456!';
    const resetRes = await mainSess.post('/auth/reset-password', {
      token: dbBeforeReset.resetToken,
      newPassword,
    });
    if (resetRes.status !== 200) {
      fail('Reset Password', `Expected 200, got ${resetRes.status}: ${JSON.stringify(resetRes.data)}`);
    } else {
      const dbAfterReset = await prisma.user.findUnique({ where: { email: testEmail } });
      if (dbAfterReset?.resetToken !== null) {
        fail('Reset Password Token Cleared', 'resetToken must be null after use');
      } else {
        pass('Reset Password', 'Password changed, resetToken cleared in DB', true);
        // Test new password works
        await delay(500);
        const loginNew = await mainSess.post('/auth/login', { email: testEmail, password: newPassword });
        loginNew.status === 200
          ? pass('New Password Login', 'Login succeeds with new password')
          : fail('New Password Login', `Expected 200, got ${loginNew.status}`);
        // Test old password fails
        await delay(500);
        const loginOld = await mainSess.post('/auth/login', { email: testEmail, password: testPassword });
        loginOld.status === 401
          ? pass('Old Password Rejected', 'Old password returns 401 after reset')
          : fail('Old Password Rejected', `Expected 401, got ${loginOld.status}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // TEST 12: LOGOUT + SESSION INVALIDATION
  // ─────────────────────────────────────────────────────
  console.log('[12/12] Logout & Session Invalidation');
  // Re-login with new password since old session may have expired after reset
  await delay(500);
  await mainSess.post('/auth/login', { email: testEmail, password: 'NewSecure456!' });
  const logoutRes = await mainSess.post('/auth/logout');
  if (logoutRes.status !== 200) {
    fail('Logout', `Expected 200, got ${logoutRes.status}: ${JSON.stringify(logoutRes.data)}`);
  } else {
    const meAfterLogout = await mainSess.get('/auth/me');
    if (meAfterLogout.status !== 401) {
      fail('Session Invalidation', `Expected 401 after logout, got ${meAfterLogout.status}`);
    } else {
      const dbAfterLogout = await prisma.user.findUnique({ where: { email: testEmail } });
      if (dbAfterLogout?.refreshToken !== null) {
        fail('Logout DB State', 'refreshToken must be null in DB after logout');
      } else {
        pass('Logout & Session Invalidation', '/auth/me→401, refreshToken=null confirmed in DB', true);
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────
  await prisma.user.deleteMany({ where: { email: { contains: 'e2e_auth_' } } });
  console.log(`\n  [CLEANUP] Removed all e2e_auth_* test users`);

  return results;
}

runAuthTests()
  .then((results) => {
    console.log('\n══════════════ AUTH TEST SUMMARY ══════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const dbVerified = results.filter(r => r.dbVerified).length;
    console.log(`  Total      : ${results.length}`);
    console.log(`  ✅ Passed  : ${passed}`);
    console.log(`  ❌ Failed  : ${failed}`);
    console.log(`  🗄️  DB Verified : ${dbVerified} assertions`);
    if (failed > 0) {
      console.log('\n  FAILURES:');
      results.filter(r => r.status === 'FAIL').forEach(r =>
        console.log(`    ✗ ${r.name}: ${r.notes}`)
      );
      process.exit(1);
    }
    console.log('\n  🎉 ALL AUTH TESTS PASSED\n');
  })
  .catch((err) => {
    console.error('\n💥 FATAL:', err?.message || err);
    process.exit(1);
  })
  .finally(() => cleanup());
