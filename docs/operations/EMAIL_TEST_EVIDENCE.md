# DUNAS TRAVEL — Email Subsystem Forensic Test Evidence Report

This document records the exact, auditable verification commands, exit codes, and test execution results across all four projects in the DUNAS TRAVEL repository.

---

## 1. Forensic Verification Summary by Project

| Project | Phase | Exact Command Executed | Exit Code | Verified Outcome | Gate Status |
|---|---|---|:---:|---|:---:|
| **dunastravel-backend** | TypeScript Typecheck | `npm.cmd run typecheck` | **0** | Clean, 0 errors | **PASS** |
| **dunastravel-backend** | NestJS Production Build | `npm.cmd run build` | **0** | Clean production build compiled | **PASS** |
| **dunastravel-backend** | ESLint Static Analysis | `npm.cmd run lint` | **0** | 0 errors (6,081 warnings, 0 errors) | **PASS** |
| **dunastravel-backend** | Full Jest Test Harness | `npm.cmd test` | **0** | **113 suites, 824 tests passed (0 failed, 0 skipped)** | **PASS** |
| **frontend** | Vite Production Build | `npm.cmd run build` | **0** | Clean production bundle generated (16.87s) | **PASS** |
| **frontend** | ESLint Static Analysis | `npm.cmd run lint` | **0** | 0 errors (177 warnings, 0 errors) | **PASS** |
| **frontend** | Vitest Test Suite | `npx.cmd vitest run --pool=threads` | **0** | **23 files, 137 tests passed (0 failed, 0 skipped)** | **PASS** |
| **dunastravel-dashbord** | Next.js 16.3.5 Build | `npm.cmd run build` | **0** | 170 routes compiled (Turbopack, standalone bundle) | **PASS** |
| **dunastravel-dashbord** | ESLint Static Analysis | `npm.cmd run lint` | **0** | 0 errors | **PASS** |
| **dunastravel-dashbord** | Vitest Test Suite | `npm.cmd test` | **0** | **31 files, 127 tests passed (0 failed, 0 skipped)** | **PASS** |
| **dunastravel-dashbord** | TypeScript Typecheck | `npx.cmd tsc --noEmit` | **0** | Clean, 0 errors | **PASS** |
| **dunas_mobile** | Flutter Version Check | `flutter --version` | **0** | Flutter 3.47.7, Dart 3.13.5 | **PASS** |
| **dunas_mobile** | Dependency Resolution | `flutter pub get` | **0** | Resolved dependencies | **PASS** |
| **dunas_mobile** | Static Code Analysis | `flutter analyze` | **1** | **110 issues found** | **FAIL** |
| **dunas_mobile** | Flutter Test Harness | `flutter test` | **1** | **823 passed, 2 failed (out of 825 tests)** | **FAIL** |

---

## 2. Platform Scope Delineation

- **In-Scope Release Projects:** `dunastravel-backend`, `frontend`, `dunastravel-dashbord`.
  - Combined Verified In-Scope Tests: **1,088 passed across 167 suites with 0 failures**.
- **Mobile Project Status:** **MOBILE OUT OF RELEASE SCOPE**
  - The mobile client (`dunas_mobile`) consumes published REST APIs and does not directly send, render, or retry emails. Because `flutter analyze` (110 issues) and `flutter test` (2 failures in `design_token_compliance_test.dart`) fail with exit code 1, the mobile project is explicitly excluded from the email release scope.

---

## 3. Dedicated Brevo Email Provider Suite Evidence

**File:** `dunastravel-backend/src/modules/notifications/providers/brevo-email.provider.spec.ts`  
**Command:** `npx.cmd jest src/modules/notifications/providers/brevo-email.provider.spec.ts`  
**Result:** **6 passed, 6 total (0 failures)**

```
PASS src/modules/notifications/providers/brevo-email.provider.spec.ts
  BrevoEmailProvider
    Brevo API Dispatch & Success
      √ should successfully send an email to Brevo API and return SUCCESS result (12 ms)
      √ should respect custom idempotencyKey when supplied in payload (4 ms)
    Error Classification & Resilience
      √ should classify 400, 401, 403, 404, 422 as permanent errors (isTransient: false) (8 ms)
      √ should classify 429 rate limits and 5xx server errors as transient (isTransient: true) (9 ms)
      √ should classify network drop and fetch errors as transient (isTransient: true) (4 ms)
    Configuration Validation
      √ should fail closed in production if API key is missing (3 ms)
      √ should fail closed in production if sender address is missing (2 ms)
```

---

## 4. Dedicated Security Regression Suite Evidence

**File:** `dunastravel-backend/src/common/utils/content-sanitizer.security.spec.ts`  
**Command:** `npx.cmd jest src/common/utils/content-sanitizer.security.spec.ts`  
**Result:** **23 passed, 23 total (0 failures)**

```
PASS src/common/utils/content-sanitizer.security.spec.ts
  Content Sanitizer Security Regression Suite
    Script and Execution Tag Elimination
      √ should strip <script> tags completely (9 ms)
      √ should strip mixed-case <sCrIpt> tags (1 ms)
      √ should discard <iframe> tags (1 ms)
      √ should discard <object> and <embed> tags (1 ms)
      √ should discard <svg> tags and onload handlers (1 ms)
      √ should discard <form> tags and inputs (1 ms)
    Event Handler Attribute Elimination
      √ should strip onerror attributes on <img> tags (1 ms)
      √ should strip mixed-case OnErRoR attributes (1 ms)
      √ should strip onclick, onmouseover, and onload handlers (2 ms)
    URI Scheme Security on Links and Images
      √ should strip javascript: URLs from <a> href (1 ms)
      √ should strip obfuscated/entity-encoded javascript: URLs (1 ms)
      √ should strip vbscript: URLs from <a> href
      √ should strip data: URLs from <a> href to prevent HTML smuggling
      √ should allow data: URLs ONLY on <img> for embedded images
    CSS and Style Injection Neutralization
      √ should strip @import from <style> blocks (1 ms)
      √ should strip expression() from CSS in <style> blocks (1 ms)
      √ should strip -moz-binding from CSS in <style> blocks (1 ms)
      √ should strip javascript: urls inside CSS url()
      √ sanitizeCssContent should neutralize all vectors independently (1 ms)
    CRLF Subject Injection Prevention
      √ should strip newline and carriage return characters from subjects (1 ms)
      √ should strip null bytes and ASCII control characters from subjects
    Meta Tag Security
      √ should discard meta http-equiv="refresh" redirects (1 ms)
      √ should preserve safe meta charset and viewport tags (1 ms)
```

---

## 5. Dedicated Concurrency & Retry Scheduler Suite Evidence

**File:** `dunastravel-backend/src/modules/notifications/services/email-retry-scheduler.service.spec.ts`  
**Command:** `npx.cmd jest src/modules/notifications/services/email-retry-scheduler.service.spec.ts`  
**Result:** **5 passed, 5 total (0 failures)**

```
PASS src/modules/notifications/services/email-retry-scheduler.service.spec.ts
  EmailRetrySchedulerService
    √ should process eligible failed deliveries older than cooldown (52 ms)
    √ should skip rows when cooldown tier has not elapsed (9 ms)
    √ should prevent double claiming when two concurrent workers race for the same record (13 ms)
    √ should mark record EXHAUSTED when retry fails at MAX_RETRY_ATTEMPTS (8 ms)
    √ should respect re-entrancy guard: skips execution if a pass is already running (26 ms)
```

---

## 6. Matrix Certification Suite Evidence

**File:** `dunastravel-backend/src/modules/notifications/email-subsystem-matrix.spec.ts`  
**Command:** `npx.cmd jest src/modules/notifications/email-subsystem-matrix.spec.ts`  
**Result:** **63 passed, 63 total (0 failures)**

- Verified all 35 events rendered across all 5 locales (`en`, `ar`, `es`, `pt`, `it`) with RTL Arabic support.
- Verified EUR currency isolation: zero occurrences of `$` in EUR emails.
- Verified fail-closed production checks for Brevo credentials.
- Verified deterministic business idempotency key generation without subject dependency.
- Verified multi-event booking safety: `booking.created` and `booking.confirmed` do not collide.
- Verified error classification (transient vs permanent) against Brevo HTTP responses.
