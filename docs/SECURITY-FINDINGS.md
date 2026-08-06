# Security Findings & Remediation Register — Dunas Travel Backend

Last Updated: 2026-07-26

| ID | Title | Severity | CWE / OWASP ASVS | Affected File / Component | Evidence / Scenario | Status |
|---|---|---|---|---|---|---|
| **SEC-01** | Non-Atomic Agent Mutation & Audit Logging | **HIGH** | CWE-273 / ASVS 7.1.1 | `agents.controller.ts`, `agents.service.ts` | Audit logging occurred after DB mutation. If audit insert failed, agent was updated without log entry. | **FIXED** (Refactored to atomic `prisma.$transaction` in Service) |
| **SEC-02** | Non-Atomic Company Mutation & Audit Logging | **HIGH** | CWE-273 / ASVS 7.1.1 | `companies.controller.ts`, `companies.service.ts` | Company creation/update occurred outside transaction of audit log. | **FIXED** (Refactored to atomic `prisma.$transaction` in Service) |
| **SEC-03** | Deterministic Search Limitations on AES-GCM Encrypted Tax IDs & Passports | **MEDIUM** | CWE-311 / ASVS 6.2.1 | `field-encryption.util.ts` | AES-256-GCM uses random IV per encryption, breaking DB exact matches and uniqueness checks. | **FIXED** (Added `generateBlindIndex()` using HMAC-SHA256) |
| **SEC-04** | Transportation Booking Replay & Duplicate Ingestion Risk | **HIGH** | CWE-799 / ASVS 13.2.3 | `transportation.service.ts` | Submitting same transfer payload twice could create duplicate bookings. | **FIXED** (Added mandatory `Idempotency-Key` and `requestHash` checking) |
| **SEC-05** | Lack of explicit contract verification test for new endpoints | **LOW** | OWASP API10:2023 | Global Route Architecture | Missing automated contract check for unannotated/unreviewed endpoints. | **OPEN / IN PROGRESS** (Pending Gate execution permission) |
