# Endpoint Security & Authentication Matrix — Dunas Travel Backend

Last Updated: 2026-07-26

| Method | Endpoint Path | Handler / Controller | Public? | Auth Mechanism | Allowed Roles | Target / Ownership Restriction | CSRF Check | Rate Limit / Quota | Classification |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | `AuthController.login` | Yes | Local / Dummy Bcrypt | Public | N/A | Excluded | Strict (10/min) | Auth / Secret |
| `POST` | `/api/auth/refresh` | `AuthController.refresh` | Yes | Cookie / Refresh Token Hash | Public | Token Match + Active Session | Enabled | Strict (10/min) | Auth / Secret |
| `POST` | `/api/auth/logout` | `AuthController.logout` | No | Bearer / Cookie | All Roles | Active Session | Enabled | Normal | Auth |
| `GET` | `/api/tours` | `ToursController.findAll` | Yes | None | Public | N/A | Skip | Normal (100/min) | Public Catalog |
| `GET` | `/api/tours/:slug` | `ToursController.findBySlug` | Yes | None | Public | N/A | Skip | Normal (100/min) | Public Catalog |
| `POST` | `/api/bookings` | `BookingsController.create` | Yes | Optional Bearer / Guest Token | Public / User | N/A (Creates Booking) | Enabled | Strict + Idempotency | Financial / PII |
| `GET` | `/api/bookings/:ref` | `BookingsController.findByRef` | Yes | Bearer / Guest Token Header | User / Guest | `userId === owner` OR valid `guestToken` | Skip | Normal | PII / Financial |
| `POST` | `/api/payments/checkout` | `PaymentsController.checkout` | Yes | Bearer / Guest Token | User / Guest | `userId === owner` OR valid `guestToken` | Enabled | Strict | Financial |
| `POST` | `/api/payments/webhook/getpayin` | `PaymentsController.webhook` | Yes | Raw signature verification (contract required) | GetPayIn | Provider event idempotency | `@SkipCsrf()` | Webhook Limit | Financial / Webhook |
| `GET` | `/api/admin/bookings` | `AdminController.listBookings` | No | Bearer / Cookie | `ADMIN`, `AGENT` | Agent scoped to assigned bookings only | Enabled | Admin Rate Limit | Internal PII |
| `POST` | `/api/admin/agents` | `AgentsController.create` | No | Bearer | `SUPER_ADMIN` | `SUPER_ADMIN` Only | Enabled | Admin Limit | Privileged Auth |
| `PATCH` | `/api/admin/agents/:id` | `AgentsController.update` | No | Bearer | `SUPER_ADMIN` | `SUPER_ADMIN` Only | Enabled | Admin Limit | Privileged Auth |
| `DELETE` | `/api/admin/agents/:id` | `AgentsController.remove` | No | Bearer | `SUPER_ADMIN` | `SUPER_ADMIN` Only | Enabled | Admin Limit | Privileged Auth |
| `POST` | `/api/admin/companies` | `CompaniesController.create` | No | Bearer | `SUPER_ADMIN` | `SUPER_ADMIN` Only | Enabled | Admin Limit | Financial / Corporate |
| `PATCH` | `/api/admin/companies/:id` | `CompaniesController.update` | No | Bearer | `SUPER_ADMIN` | `SUPER_ADMIN` Only | Enabled | Admin Limit | Financial / Corporate |
| `DELETE` | `/api/admin/companies/:id` | `CompaniesController.remove` | No | Bearer | `SUPER_ADMIN` | `SUPER_ADMIN` Only | Enabled | Admin Limit | Financial / Corporate |
| `POST` | `/api/transportation/bookings` | `TransportationController.create` | No | Bearer | `USER`, `ADMIN` | Authenticated User + Idempotency-Key | Enabled | Strict (20/min) | PII / Financial |
