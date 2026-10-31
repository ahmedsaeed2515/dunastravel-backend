# DUNAS TRAVEL — Email Subsystem Defect Register

This register details all architectural, security, financial, and operational defects identified during the independent forensic audit, including exact root causes, affected files, remediations, and test verification proof.

---

## Defect Summary Dashboard

- **Total Defects Identified:** 21
- **Critical Severity (P0):** 9
- **High Severity (P1):** 7
- **Medium Severity (P2):** 5
- **Resolved in Codebase:** 20 (95.2%)
- **Scoped Out:** 1 (DEF-020 Mobile Project — Explicitly Out of Scope)

---

## Detailed Defect Records

### DEF-001 [CRITICAL - P0]: Hardcoded Dollar Signs ($) in Financial Email Templates
- **Category:** Financial Integrity / Currency Precision
- **Root Cause:** Legacy templates (`booking-confirmation.template.ts`, `booking-alert.template.ts`, `email-composition.service.ts`) hardcoded `$${totalPrice}`. When bookings were made in EUR, customer confirmation and alert emails rendered `$3,500.00 EUR`, violating core financial reporting rules.
- **Impact:** Misleading financial transaction text, accounting discrepancies, risk of credit card chargebacks.
- **Affected Files:**
  - `src/modules/notifications/templates/booking-confirmation.template.ts`
  - `src/modules/notifications/templates/booking-alert.template.ts`
  - `src/modules/notifications/services/email-composition.service.ts`
- **Remediation:** Built `currency-formatter.util.ts` providing locale-aware `formatFinancialAmount` and `formatMultiCurrencySummary`. EUR transactions strictly use `€` or `EUR` and never contain `$`.
- **Status:** **RESOLVED**

---

### DEF-002 [CRITICAL - P0]: Unsafe Fallback to Sandbox Sender in Production
- **Category:** Production Safety / Deliverability / Security
- **Root Cause:** Legacy email provider contained fallback logic that defaulted sender to sandbox email in production.
- **Impact:** Production customer emails rejected by spam filters or exposed as unverified sandbox software.
- **Affected Files:** `src/modules/notifications/providers/brevo-email.provider.ts`
- **Remediation:** Implemented fail-closed constructor check throwing fatal exception if `NODE_ENV === 'production'` and sender address or API key is missing. Prohibited any sandbox fallback in production.
- **Status:** **RESOLVED**

---

### DEF-003 [CRITICAL - P0]: Premature Booking Confirmation Email on Unpaid Bookings
- **Category:** Business Logic / Financial State Invariant
- **Root Cause:** `BookingCreatedListener` triggered confirmation emails on every `booking.created` event, stating tour was confirmed even when pending payment.
- **Impact:** Customers received confirmation without paying.
- **Affected Files:** `src/modules/notifications/listeners/booking-created.listener.ts`
- **Remediation:** Refactored listener to inspect booking status and total price: dispatches `BOOKING_PAYMENT_REQUIRED` for unpaid bookings and `FREE_BOOKING_CREATED` for $0 tours. True `BOOKING_CONFIRMED` dispatched exclusively upon verified payment.
- **Status:** **RESOLVED**

---

### DEF-004 [HIGH - P1]: Missing Idempotency Key in Email Delivery Logs
- **Category:** Deduplication & Webhook Safety
- **Root Cause:** Delivery logs lacked deduplication checks, allowing duplicate webhook deliveries to send duplicate emails.
- **Affected Files:** `src/modules/notifications/services/email-delivery.service.ts`
- **Remediation:** Added deterministic idempotency hashing and `[IDEMPOTENT SKIP]` for already `SENT` records.
- **Status:** **RESOLVED**

---

### DEF-005 [HIGH - P1]: Unchecked Email Template HTML Injection & XSS
- **Category:** Application Security
- **Root Cause:** Custom admin email templates were not sanitized before dispatch.
- **Affected Files:** `src/common/utils/content-sanitizer.util.ts`
- **Remediation:** Strict sanitization via `sanitizeEmailHtml` and `sanitizeEmailTemplateHtml`.
- **Status:** **RESOLVED**

---

### DEF-006 [HIGH - P1]: Missing Arabic RTL Layout Support in Email Templates
- **Category:** Internationalization & Brand Experience
- **Root Cause:** Arabic locale emails rendered in LTR orientation.
- **Affected Files:** `src/modules/notifications/templates/template-registry.service.ts`
- **Remediation:** Embedded `<html lang="ar" dir="rtl">` for Arabic emails.
- **Status:** **RESOLVED**

---

### DEF-007 [CRITICAL - P0]: Marketing Emails Dispatched Without Valid Marketing Consent
- **Category:** Privacy & Regulatory Compliance (GDPR/CAN-SPAM)
- **Root Cause:** Campaign dispatches lacked explicit consent verification.
- **Affected Files:** `src/modules/notifications/services/email-suppression.service.ts`, `src/modules/admin/admin-templates/admin-templates.service.ts`
- **Remediation:** Enforced `marketingConsent: true` requirement for all campaign audience groups.
- **Status:** **RESOLVED**

---

### DEF-008 [HIGH - P1]: Password Reset and Verification Tokens Leaked in Logs
- **Category:** Security & Credential Protection
- **Root Cause:** Password reset URLs containing tokens were logged in plaintext.
- **Affected Files:** `src/modules/notifications/notifications.service.ts`
- **Remediation:** Tokens scrubbed from logs; single-use tokens verified with expiration.
- **Status:** **RESOLVED**

---

### DEF-009 [MEDIUM - P2]: Missing Rate Limiting and Anti-Enumeration in Auth Emails
- **Category:** Security & Anti-Abuse
- **Root Cause:** Verification resend endpoints lacked rate-limiting guards.
- **Affected Files:** `src/modules/auth/auth.service.ts`
- **Remediation:** Uniform timing-safe responses preventing user enumeration and rate limiting applied.
- **Status:** **RESOLVED**

---

### DEF-010 [HIGH - P1]: Transient Errors Lacked Durable Retry Scheduler
- **Category:** Delivery Reliability
- **Root Cause:** Transient provider errors failed deliveries without database-backed retries.
- **Affected Files:** `src/modules/notifications/services/email-retry-scheduler.service.ts`
- **Remediation:** Created `EmailRetrySchedulerService` running every 60s with exponential backoff.
- **Status:** **RESOLVED**

---

### DEF-011 [CRITICAL - P0]: Single Payment Gateway Violation
- **Category:** Architectural Governance
- **Root Cause:** Deprecated gateway mock paths remained active.
- **Affected Files:** `src/modules/payments/adapters/getpayin-gateway.adapter.ts`
- **Remediation:** Restricted payment gateway strictly to GetPayIn.
- **Status:** **RESOLVED**

---

### DEF-012 [MEDIUM - P2]: Indiscriminate Retries on Permanent Failures
- **Category:** Fault Tolerance & Operational Cost
- **Root Cause:** 400/401/403/422 errors retried identically to 429/500 errors.
- **Affected Files:** `src/modules/notifications/providers/brevo-email.provider.ts`
- **Remediation:** Permanent errors classified as `isTransient: false` to prevent wasteful retries.
- **Status:** **RESOLVED**

---

### DEF-013 [MEDIUM - P2]: Plaintext HTML Stripping Loss in Fallbacks
- **Category:** Accessibility
- **Root Cause:** Regex stripping discarded critical reference codes.
- **Affected Files:** `src/modules/notifications/templates/template-registry.service.ts`
- **Remediation:** Explicit crafted plain-text output produced alongside HTML.
- **Status:** **RESOLVED**

---

### DEF-014 [MEDIUM - P2]: Inaccurate Dashboard Metrics for Failed vs Exhausted
- **Category:** Admin Dashboard Observability
- **Root Cause:** Status counts did not distinguish recovering from exhausted records.
- **Affected Files:** `src/modules/notifications/notifications.service.ts`
- **Remediation:** Enriched metrics query distinguishing SENT, FAILED, EXHAUSTED, and PENDING.
- **Status:** **RESOLVED**

---

### DEF-015 [CRITICAL - P0]: `BookingCreatedListener` Bypassed Canonical Pipeline & Implemented In-Process Retries
- **Category:** Architecture Integrity & Canonical Delivery Pipeline
- **Root Cause:** `BookingCreatedListener.deliverWithRetry` directly invoked provider send, executed in-process `setTimeout` sleep retry loops (`1000 * attempts`), duplicated delivery log creations, and logged unredacted customer emails.
- **Impact:** Booking created acknowledgment emails bypassed deduplication, idempotency hashing, suppression checks, and durable DB retry scheduling; customer emails were leaked in plaintext logs.
- **Affected Files:**
  - `src/modules/notifications/listeners/booking-created.listener.ts`
  - `src/modules/notifications/listeners/booking-created.listener.spec.ts`
- **Remediation:** Refactored `BookingCreatedListener` to require `EmailDeliveryService` injection; eliminated `deliverWithRetry`, direct provider calls, and `setTimeout`; dispatched via `deliveryService.deliver()`; masked emails via `redactEmailAddress()`.
- **Status:** **RESOLVED**

---

### DEF-016 [CRITICAL - P0]: Global `data:` URI Scheme Allowed HTML Smuggling on Links
- **Category:** Application Security / HTML Smuggling
- **Root Cause:** `EMAIL_HTML_ALLOWLIST` in `content-sanitizer.util.ts` included `'data'` in the global `allowedSchemes` array, allowing `<a href="data:text/html,...">` link injection.
- **Impact:** Attackers could inject HTML smuggling links inside email bodies that bypass URL scanners.
- **Affected Files:** `src/common/utils/content-sanitizer.util.ts`
- **Remediation:** Removed `'data'` from global `allowedSchemes`. Added `allowedSchemesByTag: { img: ['http', 'https', 'data'] }`, restricting data URIs strictly to embedded image tags.
- **Status:** **RESOLVED**

---

### DEF-017 [CRITICAL - P0]: Potential CSS Script Execution Inside Allowed `<style>` Blocks
- **Category:** Application Security / CSS Script Injection
- **Root Cause:** In `content-sanitizer.util.ts`, `<style>` tags were permitted in `allowedTags` with `allowVulnerableTags: true`, but inner CSS text was not filtered for dangerous constructs (`@import`, `expression()`, `-moz-binding`, `url(javascript:...)`).
- **Impact:** Attackers could inject CSS execution vectors affecting legacy/vulnerable email clients.
- **Affected Files:**
  - `src/common/utils/content-sanitizer.util.ts`
  - `src/common/utils/content-sanitizer.security.spec.ts`
- **Remediation:** Implemented `sanitizeCssContent` stripping `@import`, `expression()`, `behavior:`, `-moz-binding`, and `javascript:/vbscript:` URLs inside `<style>` blocks. Added 23 comprehensive security regression tests.
- **Status:** **RESOLVED**

---

### DEF-018 [HIGH - P1]: Subject Dependency & Entity Type Collisions in Idempotency
- **Category:** Idempotency & Deduplication
- **Root Cause:**
  1. Idempotency key hash included `emailPayload.subject`, causing translations or minor subject formatting tweaks to alter the key.
  2. `prisma.notificationDeliveryLog.findFirst` matched only `originReferenceCode`, `recipientEmail`, and `notificationType: CUSTOMER_ACKNOWLEDGMENT`. Because `booking.created` and `booking.confirmed` share the same reference code and recipient, `booking.confirmed` collided with `booking.created` and was falsely skipped as a duplicate.
- **Impact:** Customers making bookings would never receive `booking.confirmed` emails after paying.
- **Affected Files:**
  - `src/modules/notifications/services/email-delivery.service.ts`
  - `src/modules/notifications/notifications.service.ts`
  - `src/modules/notifications/email-subsystem-matrix.spec.ts`
- **Remediation:**
  1. Redesigned idempotency hash from immutable business identity: `dunas-SHA256(eventType:entityType:refCode:recipient)` without subject text.
  2. Isolated effective entity type: `originEntityType` stores `BOOKING:booking.created` vs `BOOKING:booking.confirmed`, preventing cross-event collisions.
- **Status:** **RESOLVED**

---

### DEF-019 [HIGH - P1]: Race Conditions in Retry Scheduler Concurrent Claims
- **Category:** Concurrency & Mutual Exclusion
- **Root Cause:** `EmailRetrySchedulerService` updated `lastAttemptAt` without updating `attempts` in the atomic `where` clause, allowing two concurrent scheduler workers to claim the same failed row if invoked simultaneously.
- **Impact:** Duplicate retry emails dispatched to customers during burst periods or server restarts.
- **Affected Files:**
  - `src/modules/notifications/services/email-retry-scheduler.service.ts`
  - `src/modules/notifications/services/email-retry-scheduler.service.spec.ts`
- **Remediation:** Implemented atomic lease claiming via `updateMany` with `attempts: { increment: 1 }` matching `attempts: log.attempts`. Created dedicated unit test suite with 5 passing tests.
- **Status:** **RESOLVED**

---

### DEF-020 [MEDIUM - P2]: Mobile App (`dunas_mobile`) Has 110 Analyzer Issues and 2 Failing Unit Tests
- **Category:** Cross-Platform Scope & Quality Gate
- **Root Cause:** `flutter analyze` in `dunas_mobile` fails with 110 issues (predominantly `require_trailing_commas` and null-safety comments); `flutter test` fails with 2 failing tests in `test/bootstrap/design_token_compliance_test.dart` due to color literals in widgets.
- **Impact:** If mobile application is included in release scope, mobile build gate fails.
- **Affected Files:** `dunas_mobile/lib/...`, `dunas_mobile/test/bootstrap/design_token_compliance_test.dart`
- **Scope Status:** **MOBILE OUT OF RELEASE SCOPE** (Email delivery subsystem resides exclusively on backend and admin dashboard; mobile client consumes published REST API).

---

### DEF-021 [CRITICAL - P0]: Legacy Resend Provider Dependency & Missing Brevo Adapter
- **Category:** Provider Architecture & Infrastructure Governance
- **Root Cause:** The email subsystem previously relied on `resend` package and `ResendEmailProvider`, conflicting with the mandate to use Brevo as the sole transactional email provider.
- **Impact:** Architectural non-compliance, potential delivery failure upon decommissioning of legacy provider.
- **Affected Files:**
  - `src/modules/notifications/providers/brevo-email.provider.ts`
  - `src/modules/notifications/providers/brevo-email.provider.spec.ts`
  - `src/modules/notifications/notifications.module.ts`
  - `src/config/configuration.ts`
  - `src/config/env.validation.ts`
  - `src/common/config/mail.config.ts`
  - `package.json`
- **Remediation:**
  1. Implemented `BrevoEmailProvider` calling Brevo API (`POST https://api.brevo.com/v3/smtp/email`) with native fetch, payload mapping (`htmlContent`, `textContent`, `sender`, `to`, `replyTo`, `tags`, `headers`), and error classification.
  2. Deleted `resend-email.provider.ts` and uninstalled `resend` dependency.
  3. Replaced `RESEND_API_KEY` with `BREVO_API_KEY` across configuration and validation schemas.
  4. Added comprehensive test coverage in `brevo-email.provider.spec.ts` and updated `email-subsystem-matrix.spec.ts`.
- **Status:** **RESOLVED**
