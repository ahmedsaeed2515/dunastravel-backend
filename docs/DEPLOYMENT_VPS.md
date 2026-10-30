# Dunas Travel Backend VPS Deployment

This is the deployment procedure for the Windows Server/Plesk deployment at
`api.dunas-travel.com`. The backend is a long-running NestJS process; it is not
started through Vercel.

## Architecture

- Node.js 22.x and npm
- Plesk for Windows with the Node.js extension
- Application startup file: `dist/main.js`
- Nest global API prefix: `/api`
- PostgreSQL reachable from the VPS through `DATABASE_URL`
- Redis reachable through `REDIS_URL` (required for throttling, cache, and login security)
- Cloudinary for media; no local upload directory is required
- Resend for production email
- Exactly one backend instance while in-process scheduled jobs are enabled

## Plesk configuration

For the `api.dunas-travel.com` subscription:

1. Application root: the backend directory containing `package.json`.
2. Document root: leave Plesk's Node.js application mapping in place; do not
   point the API at `httpdocs` as a static site.
3. Application startup file: `dist/main.js`.
4. Application mode: `production`.
5. Node.js version: 22.x.
6. Keep the Plesk/IIS-managed `PORT` value. On Windows/IISNode it may be a
   named pipe and the application deliberately passes that pipe to
   `app.listen()`. For a direct local TCP run, use `PORT=5000`.
7. Set `TRUST_PROXY_HOPS=1` when HTTPS is terminated by IIS.
8. Configure the certificate and HTTP-to-HTTPS redirect in Plesk.
9. Keep `/api/metrics` restricted at the IIS/VPN layer.

## First deployment

Run these commands in the application root using the Plesk Node.js runtime:

```powershell
npm ci
npm run preflight
npm run build
npm run db:deploy
```

`db:deploy` applies pending Prisma migrations only. Never run `db:reset` on a
production database and never use the seed command as part of deployment.

Start or restart the application from Plesk. The equivalent direct command is:

```powershell
npm run start:prod
```

## Environment variables

Set these in Plesk's environment-variable UI. Values below are names and safe
shape examples only; do not copy secrets from this document.

Required in production:

```text
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
REDIS_URL=rediss://<user>:<password>@<host>:<port>
JWT_SECRET=<48+ character high-entropy secret>
JWT_REFRESH_SECRET=<different 48+ character high-entropy secret>
GUEST_TOKEN_SECRET=<different 48+ character high-entropy secret>
PII_ENCRYPTION_KEY=<64 hexadecimal characters>
RESEND_API_KEY=re_<production-key>
MAIL_FROM_ADDRESS=<verified sender email>
MAIL_FROM_NAME=Dunas Travel
MAIL_INTERNAL_ALERT_RECIPIENT=<alert recipient email>
CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<api key>
CLOUDINARY_API_SECRET=<api secret>
CORS_ALLOWED_ORIGINS=https://dunas-travel.com,https://www.dunas-travel.com,https://stage.dunas-travel.com,https://dashboard.dunas-travel.com
FRONTEND_URL=https://dunas-travel.com
ADMIN_DASHBOARD_BASE_URL=https://dashboard.dunas-travel.com
TRUST_PROXY_HOPS=1
PUBLIC_API_URL=https://api.dunas-travel.com
```

Optional or policy-controlled variables include `PORT` (Plesk-managed),
`APP_PORT`, `JWT_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `MAIL_TRANSPORT`,
`SENTRY_DSN`, `OPENEXCHANGERATES_APP_ID`, Turnstile variables, AI variables,
`DB_POOL_MAX`, and `REQUEST_TIMEOUT_MS`. If payments are enabled, also set
`PAYMENT_PROVIDER=GETPAYIN`, the GetPayIn credentials, and:

```text
GETPAYIN_REDIRECT_URL=https://dunas-travel.com/payment/return
GETPAYIN_WEBHOOK_URL=https://api.dunas-travel.com/api/payments/webhook/getpayin
```

Keep `PAYMENT_PROVIDER=DISABLED` until the GetPayIn dashboard callback and
signature configuration have been verified.

## Verification

From the VPS, first verify the process and database:

```powershell
curl.exe http://127.0.0.1:5000/api/health/liveness
curl.exe http://127.0.0.1:5000/api/health/readiness
```

Then, from a machine that can reach the public domain:

```powershell
curl.exe -i https://api.dunas-travel.com/api/health/liveness
curl.exe -i https://api.dunas-travel.com/api/auth/csrf
curl.exe -i -X OPTIONS https://api.dunas-travel.com/api/tours `
  -H "Origin: https://dunas-travel.com" `
  -H "Access-Control-Request-Method: GET" `
  -H "Access-Control-Request-Headers: x-csrf-token"
```

The automated, read-only smoke test is:

```powershell
npm run smoke:production
```

Use `SMOKE_BASE_URL` to test a staging or temporary hostname without changing
the script.

## Logs and rollback

Use Plesk's Node.js application log view and IIS site logs. A failed
`npm run preflight` is a configuration failure, not a reason to weaken
validation. To roll back, restore the previous application artifact and
environment values in Plesk, restart the single Node.js application, and
re-run the liveness and readiness checks.

## Current public-domain limitation

The repository can verify the route table and local build, but it cannot
configure the external Plesk subscription from this workspace. The observed
public responses are currently `403` for `/api` and `404` for
`/api/auth/csrf` and `/api/health/liveness`. Because these routes exist in
`src/main.ts` and the controllers, this is evidence of a Plesk/IIS routing,
startup-file, or stale-artifact problem until the VPS-side checks above pass.
