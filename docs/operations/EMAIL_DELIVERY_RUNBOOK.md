# DUNAS TRAVEL — Email Delivery & Operations Runbook

This document is the authoritative operations manual for the DUNAS TRAVEL email delivery infrastructure, covering day-to-day operations, incident diagnosis, retry handling, idempotency invariants, Brevo provider integration, and emergency recovery.

---

## 1. Subsystem Architecture Overview

```
                      [ NestJS Backend Application ]
                                    │
                                    ▼
                    [ EmailDeliveryService (Canonical) ]
                                    │
             ┌──────────────────────┴──────────────────────┐
             ▼                                             ▼
 [ Prisma Delivery Logs Table ]                [ Brevo Email Provider ]
 (notification_delivery_logs)                  (HTTP API / api-key Auth)
             │                         (POST https://api.brevo.com/v3/smtp/email)
             ▼                                             │
[ EmailRetrySchedulerService ]                             ▼
 (Cron @Interval every 60s)                    [ Internet Mail Transport ]
             │                                 (MX / DKIM / SPF / DMARC)
             ▼                                             │
    (In-Place Log Reuse)                                   ▼
                                                  [ Customer Mailbox ]
```

### Core Environment Configuration

| Variable | Description | Required | Example |
|---|---|---|---|
| `BREVO_API_KEY` | Brevo API v3 Key (`api-key` header) | YES | `xkeysib-...` |
| `MAIL_FROM_ADDRESS` | Authoritative verified sender address | YES | `info@dunas-travel.com` |
| `MAIL_FROM_NAME` | Authoritative verified sender display name | YES | `Dunas Travel` |
| `MAIL_TRANSPORT` | Active email transport provider | YES | `brevo` (`mock` in local dev/testing) |
| `MAIL_INTERNAL_ALERT_RECIPIENT` | Internal alert destination | YES | `ops@dunas-travel.com` |
| `NODE_ENV` | Environment identifier | YES | `production` / `staging` / `development` |
| `FRONTEND_URL` | Customer portal base origin | YES | `https://dunas-travel.com` |
| `ADMIN_DASHBOARD_BASE_URL` | Staff portal base origin | YES | `https://dashboard.dunas-travel.com` |
| `JWT_SECRET` | Secret used for HMAC suppression signatures | YES | `48+ character high entropy secret` |

> [!CAUTION]
> In `NODE_ENV=production`, `BREVO_API_KEY` and `MAIL_FROM_ADDRESS` **must not** be empty or unconfigured. The service fails closed during initialization with a `ServiceUnavailableException` if a real provider is missing in production.

---

## 2. Daily Health & Metrics Monitoring

### Accessing Delivery Logs in Admin Dashboard
1. Log into the Dunas Travel Admin Portal (`https://dashboard.dunas-travel.com`).
2. Navigate to **System Communications** -> **Email Delivery Logs**.
3. The dashboard displays real-time delivery entries including:
   - **Real Notification Type:** The granular event (e.g. `booking.confirmed`, `payment.refund_completed`).
   - **Recipient:** Redacted for privacy (`a***r@example.com`).
   - **Status:** `SENT`, `FAILED`, `EXHAUSTED`, `PENDING`.
   - **Attempts:** Current attempt counter (0 - 3).
   - **Provider ID:** Brevo message reference (`<...@smtp-relay.brevo.com>`).
   - **Actions:** Safe in-place "Retry Delivery" button with concurrency lease locking.

### Key Operational Metrics
- **Delivery Success Rate:** Minimum threshold is `99.5%`. Alert if `< 98.0%` over a 15-minute window.
- **Provider 429 Rate:** Alert if more than 5 rate-limit responses per hour.
- **Permanent Rejection Rate (400/401/403/404/422):** Investigate if invalid email rate exceeds `1.0%` of registrations.

---

## 3. Brevo Provider Error Diagnosis Matrix

When an email fails to deliver, the `BrevoEmailProvider` logs redacted diagnostics and assigns the error to a classification category:

| HTTP Status | Brevo Code | Classification | Automatic Action | Operator Response |
|---|---|---|---|---|
| **200 / 201** | `None` | Success | Record `status=SENT`, store `providerMessageId`. | Normal operation. |
| **400** | `invalid_parameter` | Permanent | Mark `status=FAILED`, do NOT retry. | Check email payload syntax, sender domain, and recipient formatting. |
| **401** | `unauthorized` | Permanent | Mark `status=FAILED`, do NOT retry. | **P0 Alert:** Rotate `BREVO_API_KEY` immediately in production secrets. |
| **403** | `permission_denied` | Permanent | Mark `status=FAILED`, do NOT retry. | Verify Brevo account standing, IP allowlist, and sending credits/quota. |
| **404** | `not_found` | Permanent | Mark `status=FAILED`, do NOT retry. | Verify Brevo API endpoint URL and template identifiers. |
| **422** | `unprocessable_entity` | Permanent | Mark `status=FAILED`, do NOT retry. | Recipient email address does not exist or MX records invalid. |
| **429** | `rate_limit_exceeded` | Transient | Mark `status=FAILED`, schedule DB retry with backoff. | Verify burst dispatch rate; request quota tier upgrade from Brevo. |
| **500, 502, 503, 504** | `server_error` | Transient | Mark `status=FAILED`, schedule DB retry with backoff. | Brevo cloud service incident; monitor `status.brevo.com`. |
| **Timeout / Network** | `NETWORK_ERROR` | Transient | Mark `status=FAILED`, schedule DB retry with backoff. | Verify backend outbound network, egress NAT, and DNS resolution. |

---

## 4. Idempotency & Concurrency Invariants

### Immutable Business Key Calculation
To guarantee safe retries, duplicate webhook defense, and zero false skips across email translations:
$$\text{Key} = \text{"dunas-"} + \text{SHA256}(\text{eventType} + \text{":"} + \text{originEntityType} + \text{":"} + \text{originReferenceCode} + \text{":"} + \text{recipientEmail})$$

- **Never Dependent on Subject:** Translating or rephrasing the subject line preserves the identical idempotency key.
- **Multi-Event Booking Safety:** `BOOKING:booking.created` and `BOOKING:booking.confirmed` operate under separate effective entity types and do not collide.
- **Atomic Concurrency Lease:** `EmailRetrySchedulerService` claims failed rows via `updateMany` incrementing `attempts` atomically:
  ```typescript
  updateMany({
    where: { id: log.id, status: 'FAILED', attempts: log.attempts },
    data: { attempts: { increment: 1 }, lastAttemptAt: new Date() }
  })
  ```
  Only the winning worker receives `count: 1`, guaranteeing that concurrent scheduler workers or manual retry clicks cannot duplicate email dispatches.

---

## 5. Security & Content Sanitization Rules

- **Strict Allowlist:** All email HTML is sanitized via `sanitizeEmailHtml`.
- **Scheme Isolation:** `data:` URIs are permitted **exclusively** on `<img>` tags (`allowedSchemesByTag.img`). Any `data:` or `javascript:` URI on `<a>` links is stripped.
- **CSS Injection Protection:** `<style>` blocks are parsed by `sanitizeCssContent`, stripping `@import`, `expression()`, `behavior:`, `-moz-binding`, and `javascript:/vbscript:` URLs.
- **Subject Injection Protection:** All subjects pass through `sanitizeSubject`, stripping `\r`, `\n`, null bytes, and non-printable control characters.
- **Credential Redaction:** PII and authorization keys are stripped from logs; only masked email addresses and provider message IDs are written.
