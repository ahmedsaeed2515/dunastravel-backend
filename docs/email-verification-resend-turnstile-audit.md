# 🏛️ Forensic Audit & Gap Analysis: Resend Email Verification & Cloudflare Turnstile Integration

**Target:** `dunastravel-backend`  
**Date:** September 2026  
**Auditor:** Principal Backend & API Security Engineer  
**Status:** COMPLETED — READY FOR IMPLEMENTATION  

---

## 1. Executive Summary

This forensic audit evaluates the backend authentication, email verification, notification delivery, and bot defense mechanisms in `dunastravel-backend`. The inspection covers:
- Resend integration (`ResendEmailProvider`, `EmailDeliveryService`)
- Authentication controller, services, and DTOs (`AuthService`, `AuthController`, `RegisterDto`, `VerifyEmailDto`, etc.)
- Database schema (`User`, `NotificationDeliveryLog` in Prisma ORM)
- Bot protection / Cloudflare Turnstile presence
- Configuration, environment schemas, and test coverage

### Key Verdict
The backend has a solid foundation with an existing `ResendEmailProvider`, a robust Prisma schema with partial verification fields (`isVerified`, `verifyToken`, `verifyTokenExp`), and notification logging. However:
1. **Cloudflare Turnstile** is **100% missing** (no verification service, no guard, no configuration, no endpoint checks).
2. **Email Verification** is **disabled / bypassed in code** (`requireEmailVerification` is hardcoded to `false` in `AuthService`), logs raw OTPs to console, lacks attempt counters / brute-force lockouts, lacks cooldowns on resend, and does not atomically verify or track `emailVerifiedAt`.
3. **Resend Email Delivery** lacks HTTP `Idempotency-Key` headers on sends, and retries all errors blindly without distinguishing 4xx client errors from 5xx transient failures.

---

## 2. Section A: Exact Current State Inspection

### A.1 Resend & Email Sending Architecture
- **Provider**: `src/modules/notifications/providers/resend-email.provider.ts`
  - Instantiates `Resend(apiKey)` using `resend: ^6.16.0`.
  - Implements `send(payload: EmailPayload)` with domain fallback to `onboarding@resend.dev` when domain verification fails.
  - **Issue**: Does not pass `headers: { 'Idempotency-Key': ... }` to `resend.emails.send(sendOptions)`.
- **Delivery Engine**: `src/modules/notifications/services/email-delivery.service.ts`
  - Persists attempts to `NotificationDeliveryLog`.
  - Retries up to 3 times with exponential backoff.
  - **Issue**: Treats 4xx errors (e.g. invalid recipient, authentication failure) identically to 5xx transient server errors, wasting retries and API rate limits.
- **Mock Provider**: `src/modules/notifications/providers/mock-email.provider.ts` available for testing/dev environments.

### A.2 Authentication & Verification Flow
- **Controller**: `src/modules/auth/auth.controller.ts`
  - `POST /auth/register` (`RegisterDto`)
  - `POST /auth/verify-email` (`VerifyEmailDto`)
  - `POST /auth/resend-verification` (`ResendVerificationDto`)
  - `POST /auth/login` (`LoginDto`)
  - `POST /auth/forgot-password` (`ForgotPasswordDto`)
- **Service**: `src/modules/auth/auth.service.ts`
  - Line 82 & Line 194: `const requireEmailVerification = false;` (Verification bypassed completely; users auto-verified upon registration).
  - Line 537: `this.logger.warn(`[SECURITY OTP] Verification code for ${user.email}: ${otp}`);` — exposes plaintext OTP in server logs, violating production credential safety.
  - Verification code generation: uses `crypto.randomInt(100000, 999999).toString()`, stores SHA-256 hash in `verifyToken`, with a 10-minute expiry (`verifyTokenExp`).
  - `verifyEmail`: uses non-atomic `prisma.user.findFirst` followed by `prisma.user.update`. No attempt tracking: an attacker can attempt brute-force guesses until expiry.
  - `resendVerification`: no cooldown throttling (a malicious actor or script can spam verification requests without delay).
- **Database Schema**: `prisma/schema.prisma` (`User` model)
  - Existing fields: `isVerified Boolean @default(false) @map("is_verified")`, `verifyToken String? @map("verify_token")`, `verifyTokenExp DateTime? @map("verify_token_exp")`.
  - Missing fields: `emailVerifiedAt`, `verifyAttempts`, `verifySentAt`.

### A.3 Cloudflare Turnstile
- Completely absent from the codebase:
  - 0 matches for `turnstile` across all TypeScript, JSON, and environment configuration files.
  - No secret key validation, no token exchange endpoint, no bot defense on public entrypoints (`register`, `resend-verification`, `forgot-password`).

---

## 3. Section B: Identified Gaps, Flaws & Vulnerabilities

| Area | Current Gap / Vulnerability | Risk / Severity | Required Resolution |
|---|---|---|---|
| **Bot Defense** | Zero bot protection on `register`, `resend-verification`, `forgot-password` | **HIGH** — Automated credential stuffing, spam registration, mail quota exhaustion | Implement `TurnstileService` & `TurnstileGuard` calling Cloudflare `siteverify` API with fail-closed logic and dummy key support in dev/test |
| **Verification State** | `requireEmailVerification = false` hardcoded in `AuthService` | **HIGH** — Unverified emails can access the platform without verification | Enforce verification flag via environment configuration (`AUTH_REQUIRE_EMAIL_VERIFICATION`, default `true` in production/staging) |
| **Brute-Force OTP** | No attempt limiter on OTP verification | **HIGH** — 6-digit OTP (1,000,000 possibilities) can be brute-forced during the 10-minute window | Add `verifyAttempts` counter; lock out / invalidate challenge after 5 failed attempts |
| **Resend Rate Limit** | No resend cooldown on `POST /auth/resend-verification` | **MEDIUM** — Mail provider flooding, SMS/email spamming | Enforce 60-second cooldown based on `verifySentAt` timestamp |
| **Credential Leak** | Raw OTP logged via `logger.warn` | **HIGH** — Credentials visible in centralized log drains (CloudWatch, Datadog) | Remove OTP string from all log statements (mask or log metadata only) |
| **Atomic State** | Check-then-act race condition in `verifyEmail` | **MEDIUM** — Concurrent verification requests could double-verify or bypass state checks | Use atomic Prisma transaction or conditional update (`updateMany` / atomic transaction check) |
| **Verification Timestamp** | No timestamp recording when email verification occurred | **LOW** — Compliance & auditing gap | Add `emailVerifiedAt` field to `User` model |
| **Resend Idempotency** | No `Idempotency-Key` header sent to Resend | **MEDIUM** — Network timeouts can cause duplicate emails to be sent to customers | Generate deterministic idempotency keys per notification attempt and include in Resend API headers |
| **Resend Error Handling** | Indiscriminate retry of non-transient 4xx errors | **LOW** — Wasted retries on bad email syntax or unauthenticated API keys | Classify errors: only retry transient 5xx, network timeouts, or 429 rate limits |

---

## 4. Section C: Database Schema Delta (`prisma/schema.prisma`)

To support secure OTP lifecycle, attempt throttling, cooldown tracking, and audit compliance without breaking existing data:

```prisma
// Delta on model User:
model User {
  // ... existing fields ...
  isVerified      Boolean   @default(false) @map("is_verified")
  emailVerifiedAt DateTime? @map("email_verified_at")
  verifyToken     String?   @map("verify_token")
  verifyTokenExp  DateTime? @map("verify_token_exp")
  verifyAttempts  Int       @default(0) @map("verify_attempts")
  verifySentAt    DateTime? @map("verify_sent_at")
  // ... remaining fields ...
}
```

- `emailVerifiedAt`: Stamped upon successful OTP verification.
- `verifyAttempts`: Tracks failed OTP attempts. If `>= 5`, token is invalidated immediately.
- `verifySentAt`: Stamped whenever an OTP is dispatched. Enforces a 60-second minimum cooldown before a new OTP can be requested.

---

## 5. Section D: Cloudflare Turnstile Architecture

### D.1 Specification & Verification Flow
- **Endpoint**: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- **Method**: `POST` (`application/x-www-form-urlencoded` or JSON payload)
- **Parameters**:
  - `secret`: `TURNSTILE_SECRET_KEY`
  - `response`: Token supplied by client in `cf-turnstile-token` header or body `turnstileToken`
  - `remoteip`: Client IP address from `req.ip` or `x-forwarded-for`
  - `idempotency_key`: Optional UUID for request deduplication
- **Timeout**: 5000ms with strict abort signal.
- **Fail Strategy**:
  - Production: **Fail-Closed** (network failure or invalid token returns `400 Bad Request` or `403 Forbidden`).
  - Development / Test: Bypass when `TURNSTILE_SECRET_KEY` is dummy or `SKIP_TURNSTILE=true` or test keys are used (`1x0000000000000000000000000000000AA` for always pass, `2x...AA` for always fail).

### D.2 Protected Endpoints
1. `POST /api/auth/register` (Action: `register`)
2. `POST /api/auth/resend-verification` (Action: `resend_verification`)
3. `POST /api/auth/forgot-password` (Action: `forgot_password`)

---

## 6. Section E: Resend Hardening & Idempotency Architecture

### E.1 Idempotency Key
Resend accepts custom headers in the email options:
```typescript
const options = {
  headers: {
    'Idempotency-Key': idempotencyKey || `dunas-${deliveryId}-${Date.now()}`,
  },
};
await this.resend.emails.send(sendOptions, options);
```

### E.2 Transient vs Non-Transient Failure Classification
- **Non-Transient (Abort Retry)**:
  - Status 400 (Bad Request / Invalid Email)
  - Status 401 / 403 (Invalid API Key / Unauthorized)
  - Status 422 (Unprocessable Entity)
- **Transient (Eligible for Retry with Exponential Backoff)**:
  - Status 429 (Rate Limit Exceeded — backoff honoring retry-after)
  - Status 500 / 502 / 503 / 504 (Server Errors)
  - Network timeouts (ETIMEDOUT, ECONNRESET)

---

## 7. Section F: Testing & Verification Strategy

1. **Unit Tests**:
   - `TurnstileService`: verify valid token, invalid token, Cloudflare test tokens, timeout/network error handling, and development bypass.
   - `AuthService` OTP logic:
     - Verify correct token succeeds and sets `isVerified: true`, `emailVerifiedAt: Date`, clears OTP.
     - Verify wrong token increments `verifyAttempts`.
     - Verify 5 failed attempts invalidates token.
     - Verify expired token is rejected.
     - Verify resend cooldown enforces 60-second wait.
   - `ResendEmailProvider`: verify idempotency key propagation and non-transient error handling.
2. **Integration / Contract Tests**:
   - `POST /auth/register` with Turnstile token and email verification cycle.
   - `POST /auth/verify-email` atomic consumption and attempt counter enforcement.
   - `POST /auth/resend-verification` rate-limit and cooldown response.
3. **Compilation & CI Gates**:
   - `npm run typecheck` — 0 TypeScript errors.
   - `npm test` — all existing and new test suites pass.
