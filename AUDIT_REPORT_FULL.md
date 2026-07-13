# Security and Quality Audit Report: Dunas Travel Backend

## Executive Summary
This document provides a comprehensive security and architectural audit of the Dunas Travel Node.js/TypeScript backend. The audit is complete, highlighting multiple high-severity vulnerabilities including IDORs, privilege escalation risks, and environment misconfigurations.

---

## 1. Architecture & Code Structure
**Environment Configuration (Secret Exposure)**
- **File:** `docker-compose.yml`
- **Severity:** High
- **Issue:** The PostgreSQL database password (`password`) is hardcoded in the compose file and the `POSTGRES_USER` is `postgres`. Additionally, port `5432` is exposed to the host machine.
- **Fix:** Remove hardcoded credentials from `docker-compose.yml`. Pass them via `.env` files that are ignored from version control. Do not bind `5432` and `6379` to the host in production (`ports: - "127.0.0.1:5432:5432"` or use internal Docker network only).

- **File:** `.env.example` / `.env`
- **Severity:** High
- **Issue:** Hardcoded keys for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, etc. While `.env.example` is meant as an example, developers might accidentally commit `.env` if not careful, and providing "dunas-travel-super-secret-jwt-key-change-in-production-min-32-chars" might result in it being copied directly into production environments.
- **Fix:** Leave secrets blank in `.env.example` and enforce a strong secret generation process. Confirm `.gitignore` correctly ignores `.env`.

**Application Bootstrapping (`src/main.ts`)**
- **File:** `src/main.ts`
- **Severity:** Low to Moderate
- **Issue:** The JSON body limit is set to `10mb` (`express.json({ limit: '10mb' })`). This is unusually large for standard REST APIs (except for file uploads, which typically use `multer` and multipart/form-data) and can lead to denial of service (DoS) by memory exhaustion.
- **Fix:** Reduce the JSON payload limit to `100kb` or `1mb`.

---

## 2. Authentication and Authorization
**Missing Ownership Check in Payment Initiation (IDOR)**
- **File:** `src/modules/payments/payments.controller.ts` & `src/modules/payments/payments.service.ts`
- **Severity:** High
- **Issue:** The `initiatePayment` endpoint (`POST /payments/initiate`) takes a `bookingId` from the request body to initiate a payment session. It does not verify whether the authenticated user making the request actually owns the booking. An attacker could iterate through UUIDs or intercept booking IDs, creating payment sessions for other users' bookings. 
- **Fix:** Pass `req.user.id` into `paymentsService.initiatePayment` and verify that the `booking.userId === userId` before processing the payment session.

**Agent Privilege Escalation (IDOR on Read Operations)**
- **File:** `src/modules/admin/admin.controller.ts` & `src/modules/admin/admin.service.ts`
- **Severity:** High
- **Issue:** The `AdminController` assigns `query.assigneeId = req.user.id` if the user is an `AGENT` when calling `listBookings` and `listInquiries`. However, the `listBookings` and `listInquiries` functions inside `AdminService` ignore the `assigneeId` field when constructing the Prisma `where` clause. Additionally, `getBookingByReferenceCode` in `AdminService` lacks any check to ensure that an `AGENT` is only viewing a booking assigned to them.
- **Impact:** Any user with the `AGENT` role has unauthorized full read access to all bookings and tailor-made inquiries in the system.
- **Fix:** Update `listBookings` and `listInquiries` in `AdminService` to extract `query.assigneeId` and include it in the `where` clause. Update `getBookingByReferenceCode` and `getInquiryByReferenceCode` to explicitly block `AGENT` users if `booking.assigneeId !== adminUserId`.

---

## 3. Payments Integration
**Loose Webhook Event Idempotency Handling**
- **File:** `src/modules/payments/payments.service.ts`
- **Severity:** Informational
- **Issue:** The webhook handler in `handleWebhook` silently returns a `200 OK` if the payload does not contain an `eventId`. This is done to prevent infinite retry storms from Stripe, but if valid Stripe webhooks ever lack an `eventId`, the idempotency check is bypassed entirely, which could theoretically cause double-processing.
- **Fix:** Keep the logic to avoid retry storms but log aggressively, potentially raising an internal alert.

---

## 4. Dependencies
**Dependency Risk**
- **File:** `package.json` / `audit_result.json`
- **Severity:** Moderate
- **Issue:** Known vulnerabilities exist in current dependencies (e.g., `@hono/node-server` via `prisma/dev`).
- **Fix:** Run `npm audit fix` to update packages to patched versions.

---

## 5. Deployment & Infrastructure
- **File:** `docker-compose.yml`
- **Severity:** Moderate
- **Issue:** The `Dockerfile` is built with a simple `context: .` and the `docker-compose.yml` uses default settings which may include development configurations. Need to verify `Dockerfile` multi-stage build.
- **Fix:** Review `Dockerfile` to ensure it only copies `dist` and `node_modules` (production), without dev dependencies.
