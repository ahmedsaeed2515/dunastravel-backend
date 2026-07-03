# Known Issues

This file tracks pre-existing issues and technical debt in the project that fall outside the scope of current feature work.

## Broken Unit Test Suites (Pre-existing as of Phase 9 Payment Integration)

The following 2 unit test suites are currently failing:
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/bookings/bookings.service.spec.ts`

### Root Cause
These suites fail due to mocking and dependency injection regressions introduced in prior architecture changes:
- `auth.service.spec.ts` fails with: `Nest can't resolve dependencies of the AuthService (..., ?). Please make sure that the argument "CACHE_MANAGER" at index [4] is available in the RootTestModule module.`
- `bookings.service.spec.ts` fails with: `InternalServerErrorException: Booking transaction failed | ref=... | error=Cannot read properties of undefined (reading 'updateMany')` because the mocked Prisma transaction object lacks `updateMany`.

## Broken E2E Test Suites (Pre-existing as of Phase 9 Payment Integration)

The following 3 E2E test suites are currently failing:
- `test/e2e/auth.e2e-spec.ts`
- `test/e2e/admin.e2e-spec.ts`
- `test/e2e/throttler.e2e-spec.ts`

### Root Cause
These suites fail with logical application errors (e.g., `Expected: 429, Received: 200` in Throttler, `expected 200 "OK", got 403 "Forbidden"` in Admin/Auth) rather than compilation crashes. These behavioral regressions stem from system-wide access control, soft delete, and rate-limiting modifications applied in commit `3f49797` (prior to the Payment Gateway Integration). 

These are confirmed out of scope for the Payment phase but tracked here for visibility.

### Resolution Plan
These test suites need to be refactored to resolve dependency injection circularities and properly stub the NestJS reflection metadata. This is tracked as a separate technical debt cleanup task.
