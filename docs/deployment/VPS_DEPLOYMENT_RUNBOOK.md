# Dunas Travel — VPS Deployment Runbook (Plesk / Windows)

Prerequisites read: `VPS_PRODUCTION_ARCHITECTURE.md` (same folder). This runbook
is sequential — boxes `[ ]` are checkpoints. Access mode: **RDP + Plesk UI**
(server has no public SSH; do not open SSH "because it's convenient").

---

## 1. Prepare VPS
- [ ] RDP in as Administrator. Record disk free (need ≥ 25 GB), CPU/RAM.
- [ ] Install **Node.js 22.x LTS Windows installer** (required by `engines.node`).
      Verify: `node -v` → v22.x, `npm -v`.
- [ ] Verify in Plesk → **Extensions** that **Node.js** extension is installed.
      If absent: install it (Plesk → Extensions Catalog → "Node.js").
- [ ] Windows firewall: confirm ONLY 80/443/8443(RDP)/3389(pt is 3389) exposed;
      `5432`/`6379` remain Internet-closed.

## 2. Install & configure PostgreSQL 16
- [ ] Download EDB **PostgreSQL 16** Windows x64. During setup: store **loopback**
      port `5432`, set a strong superuser password (record in password manager ONLY).
- [ ] After install, edit service config `listen_addresses = '127.0.0.1'`
      (it must NOT listen on the public interface).
- [ ] Create database + app role (execute via PSQL with real passwords typed into
      `pg_hba`: PSQL console, values go to password manager, never in chat):
      ```sql
      CREATE DATABASE dunastravel ENCODING 'UTF8';
      CREATE ROLE dunas_api LOGIN PASSWORD '<strong-secret>';
      GRANT ALL PRIVILEGES ON DATABASE dunastravel TO dunas_api;
      ```
- [ ] Confirm from the app host: `psql -h 127.0.0.1 -U dunas_api -d dunastravel -c "select 1;"`.

## 3. Restore production data (from Neon)
- [ ] **Backup first is immutable rule:** take the pre-migration Neon backup
      (provider point-in-time restore is available — note its timestamp).
- [ ] From any machine with network access to Neon (prefer a dev workstation):
      ```bash
      # use the NEON read-only/pooled connection string; never the insert credentials in git
      pg_dump --format=custom --no-owner --no-privileges ^
        -d "<NEON-DATABASE_URL>" -f dunas_prod_snapshot_YYYYMMDD.dump
      ```
- [ ] Copy `dunas_prod_snapshot.dump` to the VPS (RDP drive mapping / Plesk Files).
- [ ] Restore:
      ```bash
      pg_restore --dbname "host=127.0.0.1 port=5432 user=dunas_api dbname=dunastravel" ^
                 --no-owner --role=dunas_api --jobs=4 dunas_prod_snapshot.dump
      ```
- [ ] Extensions are none; if dump requests `uuid`, ensure `pgcrypto` present
      (`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`) before restore.
- [ ] Run backend migrations (must be a no-op if dumps include `_prisma_migrations`):
      ```bash
      npm run db:deploy
      ```

## 4. Data validation (do NOT skip)
Compare vs production (run on Neon console + local psql):
```sql
-- row counts, example list (adjust to exact table names from prisma/schema.prisma)
SELECT 'users' AS t, count(*) FROM users
UNION ALL SELECT 'admins', count(*) FROM admins
UNION ALL SELECT 'tours', count(*) FROM tours
UNION ALL SELECT 'hotels', count(*) FROM hotels
UNION ALL SELECT 'bookings', count(*) FROM bookings
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'reviews', count(*) FROM reviews
UNION ALL SELECT 'analytics events', count(*) FROM analytics_events
UNION ALL SELECT 'settings', count(*) FROM settings;
```
- [ ] Counts match within tolerance of production writes after dump time.
- [ ] Spot-check the newest booking/admin row exists (created_at compare).
- [ ] Confirm indexes restored (`\di`) — `pg_restore` without `--no-index` carries them.

## 5. Configure environment (backend)
- [ ] Copy repo to `C:\PleskSites\dunas-api\` (or clone via Plesk Git).
- [ ] Plesk → Node.js app will need `dist/`: run ON THE VPS in that folder:
      ```bash
      npm ci
      npm run preflight      # env validator — will fail until env is set below
      npm run build          # nest build
      ```
- [ ] Plesk → Node.js → Environment Variables: fill the full list from
      `VPS_PRODUCTION_ARCHITECTURE.md §6`. Core values (names, not values):
      - `NODE_ENV=production`, `PORT=5000` (the port Plesk assigns/proxies),
      - `DATABASE_URL=postgresql://dunas_api:<secret>@127.0.0.1:5432/dunastravel`,
      - `REDIS_URL=<existing provider URL — keep DAY-1>`,
      - `CORS_ALLOWED_ORIGINS=https://dunas-travel.com,https://www.dunas-travel.com,https://stage.dunas-travel.com,https://dashboard.dunas-travel.com`,
      - `TRUST_PROXY_HOPS=1`,
      - `GETPAYIN_REDIRECT_URL=https://dunas-travel.com/payment/return`,
      - `GETPAYIN_WEBHOOK_URL=https://api.dunas-travel.com/api/payments/webhook/getpayin`,
      - all secrets from the previous deployment env — reuse where safe (JWT etc.),
        regenerate `JWT_*` only if you accept client re-login.

## 6. Deploy backend (Plesk Node.js on api.dunas-travel.com)
- [ ] Plesk → Subscription `api.dunas-travel.com` → **Node.js**:
      Application Root = backend repo folder; Application Startup File = `dist/main.js`;
      Application Mode = **production**.
- [ ] Start app. Validate from the server itself:
      `curl http://127.0.0.1:5000/api/health/liveness` → JSON ok; then
      `curl http://127.0.0.1:5000/api/health/readiness` → DB ok.

## 7. Domain & reverse proxy
- [ ] Ensure IIS reverse proxy (auto-created by Plesk Node extension) forwards to
      the app port with `X-Forwarded-Proto: https`; apply
      `maxAllowedContentLength 26214400` and 120 s timeouts (see architecture file).
- [ ] Static vhosts:
      - `dunas-travel.com` (+ `www`): copy `frontend/dist/**` to `httpdocs`, add SPA
        `web.config` URL-rewrite fallback → `/index.html`, cache `/assets/*` immutable.
      - `stage.dunas-travel.com`: same with staging artifact (same backend URL).
      - `dashboard.dunas-travel.com`: Plesk Node.js app, start file
        `server.js` of the Next.js standalone build, env per architecture doc.

## 8. SSL/TLS
- [ ] Plesk → each domain → SSL/TLS: **Let's Encrypt** certificate per
      subdomain (or one DV wildcard if DNS TXT possible). Enable "Redirect HTTP→HTTPS"
      and Plesk auto-renewal.
- [ ] Re-add HSTS at IIS/Plesk as documented in architecture doc §3.5.

## 9. CORS / CSRF / OPTIONS validation (before DNS-facing test)
From a browser (F12) on `https://api.dunas-travel.com`:
```http
OPTIONS /api/analytics/events         → 403 (no Origin passthrough) or 204/200 WITH
      Access-Control-Allow-Origin: https://dunas-travel.com (origin test matters)
OPTIONS /api/auth/csrf                → must NOT be 404
GET     /api/auth/csrf                → 200 + Set-Cookie csrf_token (Secure, SameSite=None)
OPTIONS /api/payments/webhook/getpayin → 204/200 (server-side, no browser CORS needed)
```
- [ ] Preflight with `Origin: https://dunas-travel.com` and target
      `x-csrf-token,x-guest-token,idempotency-key` headers returns proper ACAO.

## 10. Cron / workers
- [ ] No Windows scheduler tasks for app crons — in-process, single API instance.
- [ ] Confirm NOT to scale here: do not run a second app instance on the DB until
      lock/dedup contract exists (see architecture doc §2.4).
- [ ] Optional: create Plesk Scheduled Task `pg_dump` fallback daily.

## 11. Email (Resend)
- [ ] Set `MAIL_TRANSPORT=resend` + `RESEND_API_KEY`; send a contact-form test →
      confirm delivered; check `MAIL_INTERNAL_ALERT_RECIPIENT` inbox.
- [ ] Verify SPF/DKIM TXT records remain (they are provider-based, independent of A records).

## 12. Payments (GetPayIn)
- [ ] Update webhook remote URL in GetPayIn portal to the new URL (§5 above).
- [ ] Keep `signature verification` / hash check ENABLED in adapter (code untouched).
- [ ] `GETPAYIN_MODE` per plan (sandbox on staging, production only when owner confirms);
      never run a REAL transaction without typed owner approval.

## 13. Frontend → VPS end-to-end QA
- [ ] `https://dunas-travel.com` loads SPA; DevTools Network shows ONLY
      `https://api.dunas-travel.com/api/...` — no Vercel, no localhost.
- [ ] CSRF + login + refresh + logout works (cookies Secure/SameSite=None present).
- [ ] Analytics `/events` succeeds, no repeating failures.
- [ ] Booking flow test (sandbox/test-mode), image loads (Cloudinary direct),
      admin dashboard login works.

## 14. Backups
- [ ] Start backup.service cron — verify the nightly dump appears and copy off-box.
- [ ] Add off-box copy of the pre-migration dump (permanent retention).

## 15. Monitoring
- [ ] External uptime monitor (§architecture 5), internal scheduled task with email
      alerting, Sentry active, disk/CPU/RAM thresholds configured.

## 16. Rollback strategy
- Roll-back vectors (in priority):
  1. Application fail → stop the Node app; the previous production consumer
     (Vercel-era or placeholder site) remains until DNS/news change.
  2. Data fail → `pg_restore` fallback: keep a "rollback snapshot" right AFTER initial
     restore (pre any user writes) + the original Neon dump. Neon can be re-selected
     via provider point-in-time restore timestamp.
  3. DNS fail → revert A records to the original value (any change is logged
     at registrar DNS panel; restore within minutes).
- Full rollback is safe because Neon/данные remains available during a rollout; the
  VPS keeps its own independent DB — rollback means re-pointing `DATABASE_URL`
  (or DNS/rebuild) not deleting anything.

## 17. Production cutover (when the current prod must move from Vercel)
- [ ] Freeze writes for 30–60 min window (maintenance banner — owner chooses expected
      downtime), OR make Neon user temporarily `read-only`.
- [ ] Re-run §3 dump + restore (final sync), re-run §4 validation.
- [ ] Restore the app; smoke-test live; declare done.
- [ ] The original Neon database is kept recoverable — afterwardDeprecate via
      owner confirmation only.

---
**Change log for runbook:** created 2026-10-29; owner: Ahmed Saeed <your-name-here>;
the earlier "Ubuntu docker-compose plan" is superseded for THIS server.
