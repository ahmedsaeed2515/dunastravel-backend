# Dunas Travel — VPS Production Architecture (Plesk / Windows)

> Status: **DESIGNED — awaiting VPS-side execution.** Verified against the actual
> repository (backend `package.json`, `prisma/schema.prisma`, `src/main.ts`,
> `src/config/env.validation.ts`, `src/modules/*`) and external probing of the
> target VPS. Do not redeploy without re-reading the runbook sibling file:
> `VPS_DEPLOYMENT_RUNBOOK.md`.

---

## 1. Target infrastructure (verified)

| Item | Verified value | Evidence |
|---|---|---|
| VPS IP | `174.138.185.79` (reverse DNS `vps3727399.trouble-free.net`) | DNS A + PTR lookup |
| OS | **Windows Server** (IIS/10.0) | HTTP headers, RDP 3389 open |
| Panel | **Plesk for Windows** (`:8443`, `:8880` open) | HTTPS probe |
| SSH | Port 22 closed — access is **RDP only** | TCP probe |
| Postgres/Redis externally exposed | **No** (`5432`, `6379` closed from Internet) — correct baseline | TCP probe |
| All product DNS | Points **exactly here** already | `dunas-travel.com`, `www`, `api.`, `stage.`, `dashboard.` → A → `174.138.185.79` |

**Consequence 1 — NO DNS switch is needed.** The domains already resolve to the
target S报关Plesk VPS. The current pages served (a 2015 jQuery template on
`/`, Plesk 404 page on `api.`) are placeholder content that gets replaced by the
deployed apps. *(This corrects the earlier assumption of switching DNS to an
Ubuntu host — the Docker/VPS compose plan `docker-compose.vps.yml` at repo root
is written for Ubuntu and is therefore **not** executable on this Windows host.
It remains in-repo as a reference topology only.)*

**Consequence 2 — deploy model must be IIS/Plesk-native**, not Docker:

```text
                                    VPS  174.138.185.79  (Windows + Plesk)
                                    │
                     ┌──────────────┼──────────────────┐
                     ▼              ▼                  ▼
            IIS vhost          IIS vhost          IIS vhost (Plesk Node.js app)
   dunas-travel.com  stage…

   1) dunas-travel.com + www    → STATIC React SPA (frontend/dist) + SPA-rewrites
   2) stage.dunas-travel.com    → STATIC React SPA (same build pipeline, staging env)
   3) api.dunas-travel.com      → IIS reverse-proxy → Node 22 (NestJS, dist/main)
   4) dashboard.dunas-travel…   → IIS reverse-proxy → Node 22 (Next.js 16 server)
                     │
                     └──► PostgreSQL 16 for Windows (127.0.0.1:5432, loopback only)
                          Redis: remote managed provider (existing REDIS_URL) DAY-1
```scss

---

## 2. Subsystems — what the backend actually requires (repo-verified)

### 2.1 Backend runtime
- **NestJS 11**, engines `node: 22.x` (`package.json`).
- Build: `npm ci` → `npm run preflight` (env validator) → `npm run build` → `node dist/main`.
- Global prefix `/api`, REST only — **no WebSockets/SSE** (no `@WebSocketGateway` in repo).
- Trust proxy: `app.set('trust proxy', TRUST_PROXY_HOPS)` — set **`TRUST_PROXY_HOPS=1`** behind IIS.

### 2.2 Database — CONFIRMED: PostgreSQL (Neon today)
- Prisma 7.8, `provider = "postgresql"` (`prisma/schema.prisma`), `@prisma/adapter-pg`.
- Current `DATABASE_URL` = **Neon** (`neon.tech` host, `sslmode=require`) — redacted; values must never be printed.
- No native extensions (PostGIS / pgvector / pg_trgm) referenced: plain relational schema with JSONB.
- Target on VPS: **PostgreSQL 18.6 for Windows (EDB installer)**, service
  `postgresql-x64-18`, bind `127.0.0.1:5432`, database `dunastravel`, dedicated
  role (no superuser for API), encoding `UTF8`. Restore rule: a dump made by the
  PG 18 utilities from Neon (server ≤ 18) can be restored into the same or a
  newer major — 18.6 is the safe ceiling and current target.

### 2.3 Redis — REQUIRED (hard requirement, verified)
Three hard consumers make Redis non-optional:
- `src/common/security/login-security-state.service.ts:27` — throws `REDIS_URL is required`
  (auth brute-force/lockout state).
- `src/app.module.ts:87` — throttler storage (`RedisThrottlerStorage`).
- `src/app.module.ts:116` — global cache (`RedisKeyvStore`, namespace `dunas-cache`).

There is **no BullMQ/RabbitMQ queue system** in the codebase — in-process
`@nestjs/event-emitter` only. So Redis is *cache + auth-state + rate limiting*, not queues.

**Decision (staged):**
- **Phase A (Day 1):** keep the **existing remote managed Redis** (same provider as today)
  by simply reusing `REDIS_URL`. Zero new moving parts, valid immediately over TLS (`rediss://`).
- **Phase B (optional later hardening):** install **Memurai** (Redis-compatible Windows
  service) locally, set `REDIS_URL=redis://127.0.0.1:6379`, and switch inside one redeploy.
  Native Redis for Windows and WSL-hosted Redis are **not accepted** (unsupported / fragile).

### 2.4 Cron / scheduled jobs — in-process
`@nestjs/schedule` (`ScheduleModule.forRoot()`), decorators verified in:
`admin/backup.service.ts` (daily 00:00 managed backup), `payments/payment-cron.service.ts`,
`availability.service.ts`, `currency.service.ts`, `media.service.ts`,
`ai/tour-knowledge-ingestion.service.ts`.

- No Windows Scheduled Tasks are needed, **but exactly ONE backend instance may run**
  against the DB until a job-dedup/DB-lock contract exists. Note: `docker-compose.vps.yml`
  passes a `RUN_SCHEDULER` env-var, however **no code reads it** (grep-verified) — do not
  rely on it; the single-instance rule is the real control.

### 2.5 Storage / uploads — CONFIRMED: Cloudinary (nothing to migrate)
`src/modules/media` uses `multer memoryStorage()` and streams straight to
Cloudinary (`CLOUDINARY_CLOUD_NAME/_API_KEY/_API_SECRET`). Media URLs live in the DB
(`/media` entities store `secureUrl`). **No local files exist and none must be migrated.**
No `uploads/` volume is required.

### 2.6 Email — CONFIRMED: Resend (API, HTTPS egress only)
`MAIL_TRANSPORT=resend` + `RESEND_API_KEY`; strict Joi validation requires it in
production. DNS DKIM/SPF TXT records for Resend are independent of any A-record
changes and stay valid. Contact/booking/reset flows use it; test after deploy.

### 2.7 Payments — CONFIRMED: GetPayIn only (`@getpayin/paylink`)
Env: `PAYMENT_PROVIDER`, `GETPAYIN_MODE('sandbox'|'production')`,
`GETPAYIN_BASE_URL`, `GETPAYIN_AUTH_TOKEN`, `GETPAYIN_HASH_TOKEN`,
`GETPAYIN_REDIRECT_URL`, `GETPAYIN_WEBHOOK_URL`.
On the VPS these MUST point to the new public endpoints:

```text
GETPAYIN_REDIRECT_URL = https://dunas-travel.com/payment/return
GETPAYIN_WEBHOOK_URL  = https://api.dunas-travel.com/api/payments/webhook/getpayin
```

and GetPayIn's merchant portal webhook remote URL must be updated to the same
webhook address. Signature/hash verification code stays enabled — never bypassed.

### 2.8 Observability bundled in the app
`@nestjs/terminus` → `GET /api/health/liveness` (process) and
`GET /api/health/readiness` (DB check). Prometheus `/metrics`
(`@willsoto/nestjs-prometheus`) — restrict to loopback/VPN at the IIS layer.
Sentry (`SENTRY_DSN` optional), winston JSON on stdout.

### 2.9 Authentication & cookies (production requirements)
Custom JWT (HttpOnly cookies) — **not Laravel/Sanctum**:
- `NODE_ENV=production` ⇒ access/refresh/csrf cookies become `Secure`, `SameSite=None`
  (`auth.service.ts`, `auth.controller.ts`).
- CSRF: custom `GET /api/auth/csrf` (sets `_csrf_token`-suffixed cookie, returns
  token) + `x-csrf-token` header on mutations (frontend `api.js` contract — verified).
- `CORS_ALLOWED_ORIGINS` must be the explicit allow-list; code
  (`src/common/security/allowed-origin.util.ts`) **rejects `*`** in production and
  validates origins with exact-match normalization.

## 3. IIS / Plesk reverse proxy requirements (per backend vhost)
When Plesk creates the Node.js app it generates an IIS site + proxy
(`web.config`). Ensure:
1. **HTTPS only** site + "Redirect HTTP→HTTPS" in Plesk;
2. Reverse proxy forwards `X-Forwarded-For`, `X-Forwarded-Proto=https` (TRUST_PROXY_HOPS=1 relies on it);
3. `requestFiltering maxAllowedContentLength = 26214400` (25 MB, matches `media` limits);
4. Timeouts ≥ 120 s for chat/AI streaming-free but long-running admin exports;
5. SPA vhosts: URL Rewrite fallback `/index.html` with 25 MB uploads limit exact and
   `Cache-Control: public,max-age=31536000,immutable` for `/assets/*`, and
   `no-cache` for `/index.html` (mirrors the retired `frontend/vercel.json`).

## 4. Backups & recovery
| Asset | Method | Frequency | Off-box destination |
|---|---|---|---|
| PostgreSQL | in-app `admin/backup.service.ts` daily dump (requires `MANAGED_BACKUPS_CONFIRMED=true`) | daily 00:00 | copy to second disk AND cloud object store |
| PostgreSQL extra | `pg_dump -Fc` scheduled via Plesk Scheduled Tasks | daily 02:30 | remote storage |
| Redis | managed provider snapshot (provider-side), no app data durability dependence | provider default | provider |
| Cloudinary | provider-side (assets stay with Cloudinary) | n/a | provider |
| Plesk system | Plesk Backup Manager (server + IIS config + env) | weekly | remote |

Restore drill: restore dump to an empty scratch DB, boot backend against it,
hit `readiness`, verify row counts. A backup is only valid after this drill passes.

## 5. Monitoring (minimum viable)
- External uptime checker pinging `https://api.dunas-travel.com/api/health/liveness`
  every 60 s (alerts on 2 consecutive failures).
- Internal Plesk Scheduled Task cycling health + readiness and e-mailing
  `MAIL_INTERNAL_ALERT_RECIPIENT` on failure.
- Windows resource monitors: CPU/RAM/disk thresholds; SSL expiry check (Plesk shows certificate status).
- Provider dashboards: Neon (DB), Redis provider latency, Cloudinary, GetPayIn webhook delivery log, Sentry.

## 6. Environment variables required on the VPS (names only — no values)
`PORT, NODE_ENV, FRONTEND_URL, PUBLIC_API_URL, CORS_ALLOWED_ORIGINS,
ADMIN_DASHBOARD_BASE_URL, TRUST_PROXY_HOPS, DATABASE_URL, REDIS_URL,
JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN, JWT_ISSUER, JWT_AUDIENCE,
GUEST_TOKEN_SECRET, AUTH_REQUIRE_EMAIL_VERIFICATION, PII_ENCRYPTION_KEY,
AI_PROVIDER, AI_PUBLIC_ENABLED, ANTHROPIC_API_KEY, ANTHROPIC_MODEL,
AI_MAX_OUTPUT_TOKENS, AI_REQUEST_TIMEOUT_MS, AI_DAILY_QUOTA_PER_ADMIN,
MAIL_TRANSPORT, RESEND_API_KEY, FROM_EMAIL, SALES_EMAIL, MAIL_FROM_ADDRESS,
MAIL_FROM_NAME, MAIL_INTERNAL_ALERT_RECIPIENT, CLOUDINARY_CLOUD_NAME,
CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, OPENEXCHANGERATES_APP_ID,
BOOTSTRAP_SUPER_ADMIN_EMAIL, BOOTSTRAP_SUPER_ADMIN_PASSWORD,
ALLOW_PRODUCTION_ADMIN_BOOTSTRAP, SEED_DEMO_DATA, MANAGED_BACKUPS_CONFIRMED,
PAYMENT_PROVIDER, GETPAYIN_MODE, GETPAYIN_BASE_URL, GETPAYIN_AUTH_TOKEN,
GETPAYIN_HASH_TOKEN, GETPAYIN_REDIRECT_URL, GETPAYIN_WEBHOOK_URL,
GETPAYIN_TIMEOUT_MS, GETPAYIN_MAX_RETRIES`
(+ dashboard finals `NEXT_PUBLIC_API_URL, NEXT_PUBLIC_FRONTEND_URL,
NEXT_PUBLIC_SITE_URL, INTERNAL_API_URL`).

Secrets live only in Plesk Node.js app environment / `.env` not committed.
Storage of variables: Plesk → Node.js → Environment Variables UI, **not** in repo.

## 7. Frontend & dashboard artifacts
- Customer SPA: build once per environment with
  `VITE_API_URL=https://api.dunas-travel.com/api` (the Dockerfile ARG pattern from
  the migration is not needed here — build on the build machine, push `dist/`).
- Staging SPA: identical bundle; if a dedicated staging backend is ever created,
  rebuild with its URL instead. **Today there is exactly one backend/DB**, so
  staging intentionally points at production API per owner decision; document the
  risk (staging actions mutate production data) until a staging DB exists.
- Dashboard: Next.js standalone (`node .next/standalone/server.js` style) behind
  Plesk Node.js app on `dashboard.dunas-travel.com`.
