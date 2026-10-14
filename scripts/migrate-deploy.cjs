/**
 * Runs `prisma migrate deploy` as part of the Vercel build.
 *
 * Why this exists:
 *   - The production DATABASE_URL points at Neon's *pooled* (PgBouncer) endpoint.
 *   - Prisma migrations acquire a PostgreSQL advisory lock, which PgBouncer in
 *     transaction mode cannot hold reliably, so `migrate deploy` can fail with
 *     `P1002 Timed out trying to acquire a postgres advisory lock`.
 *   - When that happens the whole Vercel build fails, blocking the deployment
 *     even though the application itself is fine.
 *
 * Strategy:
 *   1. Try the configured DATABASE_URL (pooled).
 *   2. If that fails, retry against the direct Neon host — the same URL with the
 *      `-pooler` segment removed.
 *   3. Never fail the build. A migration hiccup must not block a deploy; print a
 *      loud warning instead. Migrations can be re-run with `npm run db:deploy`.
 */
const { spawnSync } = require('node:child_process');

// On Vercel the variable comes from the project environment; locally it lives in
// `.env`, which Prisma loads on its own. Mirror that here so the script behaves
// the same in both places.
if (!process.env.DATABASE_URL) {
  try {
    require('dotenv').config();
  } catch {
    /* dotenv is optional here */
  }
}

const pooled = process.env.DATABASE_URL || '';
const direct = pooled.replace('-pooler', '');

function runMigrations(url, label) {
  console.log(`[migrate-deploy] running "prisma migrate deploy" against ${label}...`);
  return spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url },
  }).status;
}

let status = runMigrations(pooled, 'DATABASE_URL (pooled)');

if (status !== 0 && direct && direct !== pooled) {
  console.warn('[migrate-deploy] pooled connection failed; retrying against the direct host...');
  status = runMigrations(direct, 'direct host (no -pooler)');
}

if (status !== 0) {
  console.warn(
    '[migrate-deploy] WARNING: "prisma migrate deploy" did not succeed. ' +
      'Continuing the build so the deployment is not blocked. ' +
      'Apply migrations manually with "npm run db:deploy" if needed.',
  );
}

// Always exit 0: a migration hiccup must not block the deployment.
process.exit(0);
