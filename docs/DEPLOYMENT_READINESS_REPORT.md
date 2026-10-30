# Dunas Travel Backend Deployment Readiness Report

Date: 2026-10-30

## Executive summary

**NOT READY for public-domain sign-off.**

The backend source is prepared for a normal Node.js/Plesk process and the
public API/domain configuration is now environment-driven. Public-domain
verification is still blocked because the external Plesk site currently
returns `403` for `/api` and `404` for routes that are present in the source.
That cannot be repaired from this workspace without Plesk access.

## Architecture findings

- Framework: NestJS 11 on Node.js 22.x.
- Production entry point: `dist/main.js`; `src/vercel.ts` and `api/index.js`
  are legacy serverless compatibility files and are not the Plesk entry point.
- API prefix: `/api`.
- Authentication: JWT access/refresh cookies plus a readable CSRF cookie and
  `x-csrf-token` header for authenticated mutations.
- Database: PostgreSQL via Prisma 7 and `@prisma/adapter-pg`.
- Redis is mandatory in production for rate limiting, cache, and login security.
- Media is uploaded directly to Cloudinary; the backend does not depend on
  ephemeral local upload storage.
- Scheduled work runs in-process, so only one production instance is allowed
  until job deduplication is added.

## Verified route contract

The important public routes are:

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api` | Public | API root/status |
| GET | `/api/health/liveness` | Public | Process-only probe |
| GET | `/api/health/readiness` | Public | Database readiness probe |
| GET | `/api/auth/csrf` | Public | Sets and returns CSRF token |
| POST | `/api/auth/register` | Public | Validation, throttling, optional Turnstile |
| POST | `/api/auth/login` | Public | Sets access, refresh, and CSRF cookies |
| POST | `/api/auth/refresh` | Public | Rotates refresh/access cookies |
| GET | `/api/tours` | Public | Paginated catalog |
| GET | `/api/tours/:slug` | Public | Tour details |
| GET | `/api/destinations` | Public | Published destinations |
| POST | `/api/bookings` | Public/guest | Guest token and idempotency controls |
| POST | `/api/payments/checkout` | Public/guest | GetPayIn when explicitly enabled |
| POST | `/api/payments/webhook/getpayin` | Provider signature | Signature-verified webhook |
| GET/POST/PATCH/DELETE | `/api/admin/*` | Admin role | Cookie JWT and CSRF on mutations |

The complete source-derived controller inventory remains in
[`docs/ENDPOINT-AUTH-MATRIX.md`](./ENDPOINT-AUTH-MATRIX.md) and the API
reference files under [`docs/api/`](./api/).

## Changes made

1. Replaced the retired Vercel API fallback with
   `https://api.dunas-travel.com` in runtime configuration and validation.
2. Updated production frontend and dashboard defaults to
   `dunas-travel.com`, `dashboard.dunas-travel.com`, and the documented staging
   domain.
3. Removed localhost fallback URLs from production verification-email links.
4. Corrected the frontend CI API hostname typo.
5. Updated [`.env.example`](../.env.example) to describe the Plesk-managed
   Windows listener.
6. Added [`scripts/production-smoke-test.cjs`](../scripts/production-smoke-test.cjs),
   which checks liveness, readiness, CSRF, public catalog routes, and CORS
   without calling a mutating endpoint.
7. Added the copyable Plesk procedure in
   [`docs/DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md).

## Current blockers and risks

| Severity | Finding | Evidence | Owner |
|---|---|---|---|
| Blocker | Public Plesk site does not route to the current Nest process | Public `/api` is `403`; `/api/auth/csrf` and `/api/health/liveness` are `404` while both routes exist in source | VPS/Plesk operator |
| Blocker | Database and Redis readiness cannot be proven from this workspace | Production credentials and Plesk environment are unavailable | VPS/Plesk operator |
| Warning | In-process scheduled jobs require a single backend instance | `ScheduleModule.forRoot()` and scheduled services are enabled | Deployment owner |
| Warning | GetPayIn remains fail-closed unless explicitly configured | `PAYMENT_PROVIDER` defaults to `DISABLED` | Product/payment owner |
| Warning | Backend lint is not green before this change | Existing lint errors are reported in unrelated modules; typecheck/build/tests pass | Backend maintenance |

## Required deployment sequence

1. Back up the database and record the backup timestamp.
2. Upload/sync the backend to the Plesk application root.
3. Set the production environment variables in Plesk.
4. Run `npm ci`, `npm run preflight`, and `npm run build`.
5. Run `npm run db:deploy` after the backup.
6. Configure `dist/main.js` as the startup file and restart the app.
7. Verify local liveness/readiness from the VPS.
8. Verify the public API, CORS preflight, CSRF, and public catalog routes.
9. Switch the frontend build to `https://api.dunas-travel.com/api` and run its integration checks.

## Evidence boundary

Local source inspection and build/test commands prove repository behavior only.
They do not prove DNS, TLS, IIS reverse proxy, Plesk startup, or production
database connectivity. Mark those as VPS verified only after the commands in
[`docs/DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md) succeed on the actual server.
