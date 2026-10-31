# DUNAS TRAVEL — Email Subsystem Event Matrix & Forensic Audit

This document establishes the definitive, source-verified lifecycle matrix for all 35 email events in the DUNAS TRAVEL platform. Each event is strictly categorized based on verified source code, database lookups, producers, listeners, provider integration (Brevo), and automated test coverage.

---

## 1. Forensic Status Summary

- **Total Canonical Events Defined:** 35
- **Runtime Connected & Verified (Live Producer + Domain Listener + Delivery Pipeline):** 18
- **Template Only (Certified Multilingual Template + Variable Validation, No Live Producer Hooked):** 17 (`TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED`)
- **Bypassing Canonical Pipeline:** 0 (DEF-015 remediated)
- **Active Transactional Provider:** **Brevo** (`POST https://api.brevo.com/v3/smtp/email`)
- **Legacy Provider (Resend):** Completely removed. No runtime fallback.

---

## 2. Event Classification Definitions

| Classification | Definition |
|---|---|
| **RUNTIME_CONNECTED_VERIFIED** | Active domain producer emits event, active listener handles event, authoritative database reload executed, canonical `EmailDeliveryService` invoked, delivery logs created, verified in automated test suite. |
| **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** | Template is fully implemented across all 5 locales (`en`, `ar`, `es`, `pt`, `it`), strict variable schema enforced, CRLF/HTML sanitization enforced, verified in `email-subsystem-matrix.spec.ts`. However, no active domain producer emits this event in current production code. |
| **NOT_IMPLEMENTED** | Neither template nor runtime wiring exists. |

---

## 3. Comprehensive 35-Event Source-Backed Matrix

| # | Event Name | Event Enum | Producer Source | Listener Source | Authoritative DB Entity | Recipient(s) | Status |
|---|---|---|---|---|---|---|:---:|
| 1 | User Registration | `auth.registered` | `auth.service.ts:register()` | Direct via `NotificationsService` | `User` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 2 | Email Verification | `auth.verification` | `auth.service.ts:register()` | Direct via `NotificationsService` | `User` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 3 | Verification Resend | `auth.verification_resend` | `auth.service.ts:resendVerification()` | Direct via `NotificationsService` | `User` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 4 | Password Reset Request | `auth.password_reset_request` | `auth.service.ts:forgotPassword()` | Direct via `NotificationsService` | `User`, `PasswordResetToken` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 5 | Password Reset Completed | `auth.password_reset_completion` | `auth.service.ts:resetPassword()` | `TemplateRegistryService` | `User` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 6 | Booking Created | `booking.created` | `bookings.service.ts:1062` | `booking-created.listener.ts:46` | `Booking`, `Tour`, `BillingInfo` | Customer & Sales Team | **RUNTIME_CONNECTED_VERIFIED** |
| 7 | Booking Payment Required | `booking.payment_required` | `bookings.service.ts:createBooking()` | `booking-created.listener.ts` | `Booking`, `Tour` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 8 | Free Booking Created | `booking.free_created` | `bookings.service.ts:createBooking()` | `booking-created.listener.ts` | `Booking`, `Tour` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 9 | Booking Confirmed | `booking.confirmed` | `bookings.service.ts:1065`, `admin.service.ts:731` | `booking-created.listener.ts:217` | `Booking`, `Tour`, `Invoice` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 10 | Booking Partially Paid | `booking.partially_paid` | `payment.listener.ts:184` | `payment.listener.ts` | `Booking`, `Payment` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 11 | Payment Succeeded | `payment.succeeded` | `payments.service.ts:686`, `1150` | `payment.listener.ts:40` | `Booking`, `Payment`, `Invoice` | Customer & Sales Team | **RUNTIME_CONNECTED_VERIFIED** |
| 12 | Payment Failed | `payment.failed` | `payments.service.ts:673` | `payment.listener.ts:135` | `Booking`, `Payment` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 13 | Payment Expired | `payment.expired` | `payment-cron.service.ts` | `TemplateRegistryService` | `Payment`, `Booking` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 14 | Payment Retry | `payment.retry` | `payments.service.ts` | `TemplateRegistryService` | `Payment`, `Booking` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 15 | Refund Completed | `payment.refund_completed` | `payments.service.ts:633` | `payment.listener.ts:155` | `Booking`, `Refund`, `Payment` | Customer & Finance | **RUNTIME_CONNECTED_VERIFIED** |
| 16 | Partial Refund Completed | `payment.partial_refund_completed` | `payments.service.ts:633` | `payment.listener.ts:155` | `Booking`, `Refund`, `Payment` | Customer & Finance | **RUNTIME_CONNECTED_VERIFIED** |
| 17 | Booking Cancelled (Unpaid) | `booking.cancelled_unpaid` | `bookings.service.ts:2109` | `booking-created.listener.ts:299` | `Booking`, `Tour` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 18 | Booking Cancelled (Paid) | `booking.cancelled_paid` | `bookings.service.ts:2109` | `booking-created.listener.ts:299` | `Booking`, `Tour`, `Payment` | Customer | **RUNTIME_CONNECTED_VERIFIED** |
| 19 | Booking Status Changed | `booking.status_changed` | Admin status updates | `TemplateRegistryService` | `Booking` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 20 | Invoice Created | `invoice.created` | Admin invoices | `TemplateRegistryService` | `Invoice`, `Booking` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 21 | Invoice Paid | `invoice.paid` | Gateway webhook reconciliation | `TemplateRegistryService` | `Invoice`, `Payment` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 22 | Invoice Voided | `invoice.voided` | `admin-invoices.service.ts:283` | `TemplateRegistryService` | `Invoice` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 23 | Tailor-Made Inquiry Created | `inquiry.created` | `inquiries.service.ts:157` | `inquiry-created.listener.ts:26` | `TailorMadeInquiry` | Customer & Concierge | **RUNTIME_CONNECTED_VERIFIED** |
| 24 | Inquiry Assigned | `inquiry.assigned` | `admin-tailor-made.service.ts:393` | `TemplateRegistryService` | `TailorMadeInquiry`, `AdminUser` | Assigned Agent | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 25 | Inquiry Status Changed | `inquiry.status_changed` | Admin inquiry updates | `TemplateRegistryService` | `TailorMadeInquiry` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 26 | Inquiry Converted to Booking| `inquiry.converted` | Admin conversions | `TemplateRegistryService` | `TailorMadeInquiry`, `Booking` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 27 | Contact Form Submitted | `contact.submitted` | `contact-submissions.service.ts:63`| `contact-created.listener.ts:20` | `ContactSubmission` | Customer & Support | **RUNTIME_CONNECTED_VERIFIED** |
| 28 | Review Submitted | `review.submitted` | `reviews.service.ts:311` | `review-created.listener.ts:16` | `Review`, `Tour` | Admin Team (In-App) | **RUNTIME_CONNECTED_VERIFIED** |
| 29 | Review Moderated | `review.moderated` | Admin moderation | `TemplateRegistryService` | `Review` | Customer | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 30 | Admin Assignment | `admin.assignment` | Admin assignment | `TemplateRegistryService` | `AdminUser` | Admin Staff | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 31 | Commission Updated | `commission.updated` | `commissions.service.ts:202` | `TemplateRegistryService` | `Commission`, `Partner` | Partner Agency | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 32 | Wallet Transaction | `wallet.transaction` | `wallets.service.ts:131` | `TemplateRegistryService` | `WalletTransaction`, `Wallet` | Partner Agency | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 33 | Customer Document Update | `customer.document_update` | Customer uploads | `TemplateRegistryService` | `CustomerDocument` | Customer & Operations | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 34 | System Incident Alert | `system.incident` | Operations / Sentry alerts | `TemplateRegistryService` | System Incident log | Customer / Affected | **TEMPLATE_ONLY — NOT RUNTIME_IMPLEMENTED** |
| 35 | Marketing Broadcast | `campaign.marketing` | `admin-templates.service.ts:230` | Direct via `EmailDeliveryService` | `User` (where `marketingConsent`) | Opt-in Customers | **RUNTIME_CONNECTED_VERIFIED** |

---

## 4. Idempotency Key Design

Every notification processed through `EmailDeliveryService` uses an immutable business identity key:

$$\text{IdempotencyKey} = \text{"dunas-"} + \text{SHA256}(\text{eventType} + \text{":"} + \text{originEntityType} + \text{":"} + \text{originReferenceCode} + \text{":"} + \text{recipientEmail})$$

### Invariant Rules:
1. **Subject Stability:** Changing subject line, translations, or email body formatting does **NOT** alter the business idempotency key.
2. **Lifecycle Event Isolation:** `booking.created` (`BOOKING:booking.created`) and `booking.confirmed` (`BOOKING:booking.confirmed`) share the same booking reference code but have distinct effective entity types, preventing confirmation emails from being falsely skipped.
3. **Database Uniqueness & In-Place Updates:** Repeated events matching a record with status `SENT` trigger an immediate `[IDEMPOTENT SKIP]` returning `true` without calling the email provider. Failed records are claimed atomically and updated in-place without creating duplicate rows.
4. **Provider-Agnostic Header:** Forwarded to Brevo via HTTP header `'Idempotency-Key'`.
