# 02 Architecture Audit

## Architecture Analysis
Standard NestJS modular design.

## SOLID Violations
- File: `src/modules/bookings/bookings.service.ts` (Line: 150)
- Issue: Service handles payment processing directly, violating Single Responsibility Principle.

## Dead Code / Unused Modules
- File: `src/modules/company-self/company-self.controller.ts`
- Issue: Methods are completely unused by the frontend routing tables.
