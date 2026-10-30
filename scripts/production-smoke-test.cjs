const baseUrl = (
  process.env.SMOKE_BASE_URL || 'https://api.dunas-travel.com'
).replace(/\/+$/, '');
const origin = process.env.SMOKE_ORIGIN || 'https://dunas-travel.com';

const checks = [
  {
    name: 'liveness',
    method: 'GET',
    path: '/api/health/liveness',
    validate: (body) => body?.data?.status === 'ok' || body?.status === 'ok',
  },
  {
    name: 'readiness',
    method: 'GET',
    path: '/api/health/readiness',
    validate: (body) => body?.data?.status === 'ok' || body?.status === 'ok',
  },
  {
    name: 'csrf',
    method: 'GET',
    path: '/api/auth/csrf',
    validate: (body) =>
      typeof (body?.data?.csrfToken || body?.csrfToken) === 'string',
  },
  {
    name: 'destinations',
    method: 'GET',
    path: '/api/destinations?locale=en',
    validate: (body) => body?.success === true,
  },
  {
    name: 'tours',
    method: 'GET',
    path: '/api/tours?lang=en&page=1&limit=1',
    validate: (body) => body?.success === true,
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // The status code is still reported below for infrastructure failures.
  }
  return { response, body };
}

async function main() {
  console.log(`Production smoke test target: ${baseUrl}`);
  let failed = false;

  for (const check of checks) {
    try {
      const { response, body } = await request(check.path, {
        method: check.method,
      });
      const passed = response.ok && check.validate(body);
      console.log(
        `${passed ? 'PASS' : 'FAIL'} ${check.method} ${check.path} (${response.status})`,
      );
      if (!passed) failed = true;
    } catch (error) {
      failed = true;
      console.log(
        `FAIL ${check.method} ${check.path} (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  try {
    const { response } = await request('/api/tours', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'x-csrf-token',
      },
    });
    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowCredentials = response.headers.get(
      'access-control-allow-credentials',
    );
    const passed =
      response.ok &&
      allowOrigin === origin &&
      allowCredentials === 'true';
    console.log(
      `${passed ? 'PASS' : 'FAIL'} CORS preflight (${response.status}, allow-origin=${allowOrigin || 'missing'})`,
    );
    if (!passed) failed = true;
  } catch (error) {
    failed = true;
    console.log(
      `FAIL CORS preflight (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  if (failed) {
    console.error(
      'Production smoke test failed. No mutating endpoint was called.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('Production smoke test passed. No mutating endpoint was called.');
}

main().catch((error) => {
  console.error(
    `Production smoke test failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
