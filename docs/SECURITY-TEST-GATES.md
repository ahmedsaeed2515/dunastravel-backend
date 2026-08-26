# Security Test Gates & Compliance Register — Dunas Travel Backend

Last Updated: 2026-07-26

> **Status Notice**: All test gates requiring command execution (`build`, `test`, `lint`, `typecheck`, `prisma validate`) are currently marked **`NOT RUN — USER REQUEST`** as per user explicit instruction.

| Gate ID | Gate Name | Required Criteria | Current Status | Notes / Evidence |
|---|---|---|---|---|
| **GATE-01** | Authentication Denial Test | All non-`@Public()` routes return HTTP 401 when no auth token provided | `NOT RUN — USER REQUEST` | Enforced via global `JwtAuthGuard` in `app.module.ts`. |
| **GATE-02** | Role Authorization Test | Non-permitted roles return HTTP 403 Forbidden | `NOT RUN — USER REQUEST` | Enforced via `RolesGuard` and explicit in-service role checks. |
| **GATE-03** | Public Route Audit | Public routes match explicit allowlist | `NOT RUN — USER REQUEST` | Verified by code inspection of `@Public()` decorators. |
| **GATE-04** | SUPER_ADMIN Immunity Test | `ADMIN` role cannot delete/suspend `SUPER_ADMIN` | `NOT RUN — USER REQUEST` | Enforced in `AdminService` & `AgentsService`. |
| **GATE-05** | Session Invalidation Test | Reset/change password invalidates existing refresh sessions | `NOT RUN — USER REQUEST` | Enforced via `sessionVersion` increment logic. |
| **GATE-06** | CSRF Double-Submit Test | Cookie-authenticated mutations require valid `X-CSRF-Token` | `NOT RUN — USER REQUEST` | Enforced via double-submit cookie pattern middleware. |
| **GATE-07** | GetPayIn signature test | Invalid GetPayIn webhook signature is rejected according to its official contract | `BLOCKED — MERCHANT CONTRACT REQUIRED` | The adapter is fail-closed until official signature fixtures are supplied. |
| **GATE-08** | Idempotency Replay Test | Repeated request with same `Idempotency-Key` returns existing record without duplicate DB write | `NOT RUN — USER REQUEST` | Enforced in `bookings.service.ts` & `transportation.service.ts`. |
| **GATE-09** | Stored XSS Mitigation Test | Payload containing `<script>` or event handlers is sanitized | `NOT RUN — USER REQUEST` | Enforced in `content-sanitizer.util.ts`. |
| **GATE-10** | TypeScript Typecheck & Build | Zero compile errors | `NOT RUN — USER REQUEST` | Pending user permission for execution. |
