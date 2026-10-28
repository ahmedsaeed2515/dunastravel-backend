#!/usr/bin/env node
/**
 * Disposable Database E2E Runner
 * Enforces DISPOSABLE_DB_CONFIRMED=true and ALLOW_DISPOSABLE_DB_MUTATION=true
 * targeting the local isolated disposable PostgreSQL database.
 */
process.env.ALLOW_DISPOSABLE_DB_MUTATION = 'true';
process.env.DISPOSABLE_DB_CONFIRMED = 'true';
if (
  !process.env.TEST_DATABASE_URL &&
  (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('neon.tech'))
) {
  process.env.TEST_DATABASE_URL =
    'postgresql://rivo_admin:rivo_admin_password@127.0.0.1:5432/dunastravel_test?schema=public';
}

const { spawnSync } = require('child_process');
const args = [
  'jest',
  '--config',
  'test/jest-e2e.json',
  'test/disposable-db.e2e-spec.ts',
  'test/payment-webhook.e2e-spec.ts',
  '--runInBand',
  ...process.argv.slice(2),
];

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 0);
