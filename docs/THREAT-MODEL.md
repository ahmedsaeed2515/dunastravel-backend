# Threat Model — Dunas Travel Backend

Last Updated: 2026-07-26
Status: Active Reference Document

---

## 1. Asset Inventory & Trust Boundaries

| Asset / Component | Trust Boundary | Sensitivity Level | Description |
|---|---|---|---|
| Customer PII (Passports, Emergency Contacts, Addresses) | Application Server / DB Layer | **HIGH (PII)** | Encrypted using AES-256-GCM at rest (`field-encryption.util.ts`). Keyed blind indexes (HMAC-SHA256) used for exact lookups without decrypting entire table. |
| Authentication Credentials & Session Secrets | DB / Redis / Memory | **CRITICAL** | Bcrypt password hashes, hashed refresh tokens (`SHA-256`), hashed password reset/verification tokens, `sessionVersion` increments on privilege change. |
| Financial & Payment Ledger Data | Payments Engine / GetPayIn boundary | **CRITICAL (Financial)** | Ledger entries, transaction IDs, payment capture/refund status, immutable invoices. Checked with strict double-submit idempotency & database unique constraints. |
| Administrative Controls & Privileged APIs | Internal API (`/admin/*`) | **CRITICAL (Privileged)** | Restricted to `ADMIN` and `SUPER_ADMIN` roles via `RolesGuard` and explicit in-service authorization checks. Last `SUPER_ADMIN` protected against deletion/suspension. |
| Customer Media & Documents | Cloud Storage (Cloudinary/S3) | **HIGH** | Public tour media vs Private customer documents (IDs, Vouchers). Verification of MIME type, magic bytes, dimensions, and strict entity-bound upload authorization. |

---

## 2. Threat Actor Profiles

1. **Anonymous Web Attacker**
   - **Goal**: Unauthenticated access, API brute forcing, SSRF, DoS, booking availability exhaustion, promo quota harvesting.
   - **Mitigations**: Default-Deny route protection (`@Public()` decorator required), Global Throttling / Redis Rate Limiting, input bounds & regex sanitization.

2. **Authenticated Customer**
   - **Goal**: IDOR / BOLA (viewing other customers' bookings, invoices, passports), price manipulation, race conditions on promotions/capacity.
   - **Mitigations**: In-service ownership enforcement (`userId` check), immutable pricing computed strictly server-side, serializable DB transactions.

3. **Compromised AGENT Account**
   - **Goal**: Privilege escalation, modifying unassigned bookings, viewing unauthorized CRM records or export CSVs.
   - **Mitigations**: Agent scope restriction (only assigned bookings), explicit SUPER_ADMIN guards on critical financial and role transitions.

4. **Malicious / Compromised ADMIN Account**
   - **Goal**: Elevating privileges to SUPER_ADMIN, modifying global financial terms, deleting audit logs, deleting last SUPER_ADMIN.
   - **Mitigations**: Immutable Audit logs, SUPER_ADMIN explicit defense in Service layer, protection against self-demotion/self-deletion for last SUPER_ADMIN.

5. **Network / Replay Attacker**
   - **Goal**: Eavesdropping requests, replaying payment initiation or booking requests.
   - **Mitigations**: Mandatory HTTPS in production/staging, strict double-submit CSRF, `Idempotency-Key` and `requestHash` checking on financial endpoints.

---

## 3. Threat Matrix & Abuse Scenarios

### T-01: Replay & Double-Booking Attack
- **Threat**: Attacker captures valid booking creation request and replays it multiple times.
- **Controls**: `Idempotency-Key` requirement + sha256 `requestHash` matched in `transportation.service.ts` and `bookings.service.ts`. If key matches with same payload, existing booking is returned; if payload differs, 409 Conflict is thrown.

### T-02: BOLA / IDOR on Guest & Customer Bookings
- **Threat**: Attacker guesses or iterates booking UUIDs / reference codes to view foreign PII or invoices.
- **Controls**: Guest bookings require constant-time HMAC-SHA256 `guestToken` verification. Authenticated bookings require `userId === ownerId` inside `BookingsService.findByReferenceCode()`.

### T-03: Webhook Spoofing & Replay (GetPayIn)
- **Threat**: Attacker sends forged raw payment webhook requests to force booking status to `PAID`.
- **Controls**: Raw body signature verification using provider secrets before JSON parsing; atomic idempotent event insertion in DB (`payment_webhook_events`); payment amount and currency verified against DB invoice snapshot.

### T-04: Mass Assignment & Financial Tampering
- **Threat**: Client supplies `totalAmountUsd`, `status: PAID`, or `role: SUPER_ADMIN` in registration/booking DTOs.
- **Controls**: Strict NestJS `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Server recalculates all pricing from base DB rates. Financial status transitions allowed only via ledger execution.

### T-05: Stored XSS via Rich Content & User Submissions
- **Threat**: Attacker embeds `<script>` or malicious SVG/HTML payload in contact submissions, inquiries, or review comments.
- **Controls**: `content-sanitizer.util.ts` applies strict HTML sanitization and plain-text stripping (`sanitizePlainText`). SVG and JavaScript protocols strictly stripped.

---

## 4. Detection & Recovery Strategies

- **Audit Logging**: All privileged mutations (Agent creation/update/deletion, Company modifications, status changes) are written atomically inside the same `prisma.$transaction` as the mutation.
- **Sentry Error Tracking**: Sanitized error logging (`sendDefaultPii: false`, headers/cookies stripped) to alert on unhandled 500 errors without leaking secrets.
- **Incident Response**: In case of key compromise or unauthorized activity, runbooks in `PRODUCTION-SECURITY-RUNBOOK.md` define step-by-step token revocation and session invalidation via `sessionVersion` increments.
