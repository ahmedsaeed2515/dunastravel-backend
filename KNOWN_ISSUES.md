# Known Issues

This file tracks pre-existing issues and technical debt in the project that fall outside the scope of current feature work.

## Broken Unit Test Suites (Pre-existing as of Phase 9 Payment Integration)

The following 6 unit test suites are currently failing:
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/bookings/bookings.service.spec.ts`
- `src/modules/admin/admin.service.spec.ts`
- `src/modules/tours/tours.service.spec.ts`
- `src/common/logging/json-logger.service.spec.ts`
- `src/modules/notifications/listeners/booking-created.listener.spec.ts`

### Root Cause
These suites fail with `TypeError: Cannot read properties of undefined (reading 'get')` or `reading 'name'` at `decoratorFactory` (from `@nestjs/event-emitter/lib/decorators/on-event.decorator.ts` and `@nestjs/swagger/dist/decorators/helpers.js`).

This is a known circular dependency metadata issue caused by architectural modifications in commit `3f49797` (when roles, permissions, and metrics were overhauled). The `isolatedModules: true` / caching mismatches exacerbated this locally, but testing confirmed these failures predate the Payment Gateway Integration phase (verified against commit `22dbdf8`).

### Resolution Plan
These test suites need to be refactored to resolve dependency injection circularities and properly stub the NestJS reflection metadata. This is tracked as a separate technical debt cleanup task.
