# Project Overview

**Purpose:** Dunas Travel is a production-ready luxury travel platform backend. It serves as the foundation for booking tailor-made tours, managing itineraries, processing invoices, and handling customer inquiries.
**Business Domain:** Luxury Travel and Tour Booking.
**Technology Stack:**
- **Framework:** NestJS (TypeScript, Strict Mode)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** class-validator, class-transformer
- **Authentication:** Passport, JWT (HttpOnly Cookies)
- **Event Bus:** EventEmitter2
**Architecture Philosophy:**
- **Clean Architecture:** Strict boundaries between domain logic and external systems. Leaf features do not block core features.
- **SOLID Principles:** High cohesion, low coupling. E.g., The Notifications module acts as a pure consumer without modifying producers.
- **Production-First Approach:** Zero TODOs. Zero placeholders. Every phase includes validation, rate-limiting, comprehensive logging, strict typing, and full compilation/linting checks before being considered locked.

---

# Current Backend Architecture

**Folder Structure:**
The project follows a standard NestJS feature-module structure.
```
src/
├── common/         # Shared infrastructure (guards, decorators, filters, interceptors, utils)
├── modules/        # Feature modules (auth, tours, bookings, invoices, inquiries, notifications, prisma)
├── app.module.ts   # Root module
└── main.ts         # Application entry point
```

**Modules:**
- **PrismaModule:** Global database access.
- **AuthModule / UsersModule:** JWT-based authentication and Role-Based Access Control (RBAC).
- **ToursModule:** Catalog of tours with multilingual support and pricing.
- **BookingsModule:** Financial reservations, calculating totals and holding passenger data.
- **InvoicesModule:** Generating 1:1 invoice records per booking.
- **InquiriesModule:** Public capture of tailor-made tour requests and staff management endpoints.
- **ContactSubmissionsModule:** Public capture of generic contact inquiries.
- **NotificationsModule:** Event-driven email composition and delivery with retries.

**Shared Infrastructure:**
- **Interceptors:** Global transform interceptors standardizing response shapes.
- **Exception Filters:** Global exception filters standardizing error formats.
- **Authentication:** JWTs stored in HttpOnly cookies, verified via Passport strategies.
- **Guards:** `JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard`, and `ThrottlerGuard` for rate limiting.
- **Event System:** Node's `EventEmitter2` configured globally for decoupled producer-consumer communication (e.g., `inquiry.created`).
- **Logging:** NestJS built-in `Logger` tracking lifecycle events, domain events, and failures.

---

# Completed Phases

### Phase 0: Initialization
- **Goal:** Bootstrapping the NestJS environment.
- **Features implemented:** Basic project scaffolding, global exception filters, logging, and health checks.
- **Important architectural decisions:** Strict TypeScript mode. Production-ready configurations.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 1: Database
- **Goal:** Establish PostgreSQL schema and Prisma ORM.
- **Features implemented:** `schema.prisma` models for Users, Tours, Bookings, etc. Seed script for initial data.
- **Important architectural decisions:** Relational integrity via Prisma, JSONB for multilingual fields, Decimal for financial fields.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 2: Common Infrastructure & Auth
- **Goal:** Establish RBAC, JWT authentication, and global guards.
- **Features implemented:** Auth controllers, Passport strategies, `RolesGuard`, `JwtAuthGuard`, and rate limiting (`ThrottlerGuard`).
- **Important architectural decisions:** JWTs stored securely in HttpOnly cookies to prevent XSS. Global exception standardizations.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 3: Tours Module
- **Goal:** Public catalog API for browsing tours.
- **Features implemented:** Paginated, multilingual endpoints for tours. Prisma seeding updates.
- **Important architectural decisions:** Server calculates base prices. Multilingual JSONB parsing via DTOs. Swagger documentation conventions established.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 4: Bookings & Invoices Module
- **Goal:** Booking engine and invoice retrieval.
- **Features implemented:** Guest/Auth booking creation, passenger management, total calculation, unique reference code generation, invoice record creation.
- **Important architectural decisions:** Booking total is server-calculated; client prices are untrusted. Event emission upon successful booking.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 5: Tailor-Made Tour Inquiries
- **Goal:** Enable anonymous visitors to submit custom multi-destination tour requests.
- **Features implemented:** Public submission endpoint with strict rate-limiting. Admin endpoints for listing/updating statuses. Event emission (`inquiry.created`).
- **Important architectural decisions:** Completely independent from Bookings. Collision-safe reference codes (`INQ-XXXXXX`).
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 6: Notifications & Email Integration Module
- **Goal:** Event-driven email delivery.
- **Features implemented:** Listener for `inquiry.created`. Templates for customer acknowledgment and internal sales alert. Mock email provider adapter. Bounded retry logic.
- **Important architectural decisions:** Pure consumer module. Schema decoupled entirely (no foreign keys to origin entity). Fallback logic isolated from the event emitter.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 7: Contact Submissions Module
- **Goal:** Enable anonymous visitors to submit generic contact inquiries.
- **Features implemented:** Public submission endpoint with strict rate-limiting. Event emission (`contact.created`). Listener in `NotificationsModule`.
- **Important architectural decisions:** Independent module reusing the event consumer patterns established in Phase 6.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 8: Admin APIs Module
- **Goal:** Centralized aggregation API for all backoffice operations.
- **Features implemented:** `AdminModule`, strict DTOs/Interfaces for 10 management endpoints covering Bookings, Inquiries, Contact Submissions, Notification Logs, and Dashboard Metrics.
- **Important architectural decisions:** The `AdminModule` acts as a top-level unified gateway governing all operational actions. It queries `PrismaService` directly for cross-entity aggregations, and it explicitly supersedes any legacy `/admin` routes from earlier modules.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 9: Real Mail Infrastructure
- **Goal:** Replace the mock email provider with a production-ready transport layer using Resend.
- **Features implemented:** `ResendEmailProvider`, strict typed HTML templates using pure functions, dynamic dependency injection, secure environment variables (`mail.config.ts`).
- **Important architectural decisions:** The core event-driven nature of `NotificationsModule` was preserved perfectly; `EmailPayload` was strongly typed as an internal transport boundary. Application startup now fail-fasts on missing mail configs.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 10: Media Management Module
- **Goal:** Abstract storage logic and provide endpoints for secure, robust image uploads.
- **Features implemented:** `MediaModule`, `CloudinaryStorageProvider`, `FileValidationPipe` (verifying Magic Numbers), `MediaAsset` model tracking uploads and seeded files, unified event emitting `media.uploaded`.
- **Important architectural decisions:** Storage provider injected via token. Media models do not enforce strict foreign keys to generic entity types, preserving decoupling. Automated linkage to `TourImage` models on successful upload for tours.
- **Verification status:** Passed.
- **Lock status:** 🔒 Locked.

### Phase 11: Booking Notifications & Production Hardening
**Status: Locked**
Closes the booking lifecycle loop by sending confirmation emails to customers and internal sales alerts to the team upon booking creation, utilizing the Notification module's robust delivery mechanisms.

### Phase 14: Production Hardening & Deployment Readiness
**Status: Locked**
Transforms the feature-complete backend into a containerized, observable, and secure production artifact. Includes multi-stage Docker builds, structured JSON logging with correlation IDs, Helmet security headers, graceful shutdown hooks, differentiated health probes (`/live` and `/ready`), dynamic cookie hardening, Nginx configuration templates, and a unified Joi environment validation schema. Ensures the backend is ready for deployment to any OCI-compatible platform.

---

# Current Features

- **Health Check (`/api/health`):** Verifies API is running. Production-ready.
- **Authentication (`/api/auth/*`):** Register, login, logout, and `/me`. Uses secure HttpOnly cookies. Production-ready.
- **Tours Catalog (`/api/tours`):** Public browsing of itineraries and pricing. Multilingual. Production-ready.
- **Booking Engine (`/api/bookings`):** Supports authenticated and guest checkouts, passenger collection, server-side price calculation. Production-ready.
- **Invoices (`/api/invoices`):** Generation of unguessable invoice links. Production-ready.
- **Tailor-Made Inquiries (`/api/inquiries`):** Captures custom tour requests, emits domain events, rate-limited strictly. Admin management included. Production-ready.
- **Contact Submissions (`/api/contact`):** Captures generic queries, emits domain events, strictly rate-limited. Production-ready.
- **Email Notifications (Internal):** Listens to domain events (`inquiry.created`, `contact.created`), composes localized HTML emails using typed templates, attempts delivery via **Resend** with bounded retries, logs delivery state durably. Production-ready.

---

# Frontend Feature Mapping

- **Tour Listing / Details Page:** Implemented. Supported by `ToursModule`.
- **Checkout / Booking Flow:** Implemented. Supported by `BookingsModule` (Confirmation email now implemented in Phase 11).
- **User Dashboard (My Bookings):** Implemented. Supported by `BookingsModule` and `AuthModule`.
- **Custom Tour Request Form:** Implemented. Supported by `InquiriesModule`.
- **Invoice Viewing / Printing:** Implemented. Supported by `InvoicesModule`.
- **Contact Us Form:** Implemented. Supported by `ContactSubmissionsModule`.
- **Admin CRM / Dashboard:** Not Implemented. Pending Phase 8 (Admin APIs).
- **Payment Processing (Stripe/Paypal):** Not Implemented. Pending future leaf phase.
- **File Uploads (Passports/Avatars/Tour Images):** Implemented. Supported by `MediaModule`.

---

# Remaining Backend Features

1. **Currency Conversion Proxy:**
   - **Why:** Display pricing in local currencies (EUR, GBP, etc.).
   - **Requires:** Nothing (Leaf node).
   - **Order:** Parallelizable.

2. **AI Proxy Integration:**
   - **Why:** Enhancing search or generating dynamic itineraries.
   - **Requires:** Nothing (Leaf node).
   - **Order:** Parallelizable.

---

# Current Roadmap

- **Phase 9+ (Leaf Features):** Currency, AI, File Uploads. Can be tackled in any order as they do not block architectural cores.

---

# Event-Driven Architecture

**Existing Producers:**
- `BookingsModule` emits booking lifecycle events.
- `InquiriesModule` emits `inquiry.created` (Phase 5).
- `ContactSubmissionsModule` emits `contact.created` (Phase 7).

**Existing Consumers:**
- `NotificationsModule` (Phase 6, 7, & 11) listens to `inquiry.created`, `contact.created`, and `booking.created`.

**Event Flow:**
1. Action occurs (e.g., POST `/api/inquiries`).
2. Controller ➔ Service ➔ Database Transaction.
3. Upon commit, `EventEmitter2` fires domain event asynchronously.
4. `NotificationsModule` catches event ➔ Composes template ➔ Delivers ➔ Logs success/failure. 
5. If delivery fails, bounded retry occurs purely within `NotificationsModule`, never affecting the HTTP response of the producer.

---

# Database Overview

**Core Models:**
- `User`: Accounts and RBAC (`UserRole`).
- `Tour`: Catalog base. Includes `TourItinerary` (day-by-day) and `TourImage` (gallery).
- `Booking`: Financial reservation. Relates to `Passenger` (travelers) and `BillingInfo`.
- `Invoice`: 1:1 with Booking.
- `TailorMadeInquiry`: Phase 5 custom tours.
- `ContactSubmission`: Phase 7 generic inquiries.
- `NotificationDeliveryLog`: Phase 6/7 durable event tracking for CRM visibility.

**Architectural Decisions:**
- Relational integrity heavily enforced via Cascade/Restrict deletions.
- No direct foreign keys from generic logs (`NotificationDeliveryLog`) to specific models (`TailorMadeInquiry`). Plain string identifiers (`originReferenceCode`) are used to maintain Clean Architecture decoupled boundaries.
- Native `Json` and `String[]` types utilized effectively in PostgreSQL.

---

# Security Overview

**Implemented:**
- Strictly typed inputs and DTO validation.
- HTTP-Only Cookie JWT Authentication (prevents XSS token theft).
- RBAC Guarding (`RolesGuard`) for admin-only routes.
- Rate limiting (`ThrottlerGuard`) configured stringently on public endpoints.
- Database cascade restriction preventing accidental orphaned financial records.

**Remaining:**
- Specific origin CORS configurations for production.
- Real Payment Gateway security (PCI compliance if handling cards directly, though Stripe elements usually abstract this).
- Secrets management integration (AWS Secrets / Hashicorp Vault) before true prod deployment.

---

# API Overview

- **`GET /api/health`** (Public)
- **`POST /api/auth/register`** (Public)
- **`POST /api/auth/login`** (Public)
- **`POST /api/auth/logout`** (Public)
- **`GET /api/auth/me`** (Auth)
- **`GET /api/tours`** (Public)
- **`GET /api/tours/:slug`** (Public)
- **`POST /api/bookings`** (Public/Auth)
- **`GET /api/bookings/:referenceCode`** (Auth)
- **`GET /api/invoices/:invoiceNumber`** (Public-Unguessable)
- **`POST /api/inquiries`** (Public - Rate Limited)
- **`POST /api/contact`** (Public - Rate Limited)
- **`GET /api/admin/inquiries`** (Admin)
- **`GET /api/admin/inquiries/:referenceCode`** (Admin)
- **`PATCH /api/admin/inquiries/:referenceCode/status`** (Admin)
- **`POST /api/admin/media/upload`** (Admin)
- **`DELETE /api/admin/media/:id`** (Admin)
- **`GET /api/admin/media`** (Admin)
- **`GET /api/media/tours/:tourId`** (Public)

---

# Development Workflow

Claude
↓
Implementation Prompt
↓
Integrate AI
↓
Implementation
↓
Quality Gate
↓
Phase Locked

**Locked phases are immutable.** Future features extend the system additively via boundaries and event interception without altering working past phases.

---

# Coding Standards

- **Strict TypeScript:** `noImplicitAny`, strict null checks enforced.
- **Eslint:** Zero tolerance for warnings/errors in the build pipeline.
- **Immutability:** Locked phases cannot be touched to retrofit features. Extensions must be additive.
- **Event-Driven Decoupling:** Producers never know about consumers.

---

# Important Rules

1. **Zero Placeholders:** Code is written entirely ready for production. No `// TODO`s.
2. **Defensive Programming:** Server never trusts client calculations (e.g., booking totals).
3. **Strict Isolation:** Modules communicate via events or strict service boundaries, never cross-querying internal database tables belonging to other modules.
4. **In-Process Bounded Retries:** Failures in leaf consumers (like emails) do not throw back into the HTTP request stack.

---

## Current Project Status
- **Phases 0-14:** Completed and Locked.
- **Production Status:** The backend is fully containerized, secure, and deployment-ready. No further backend phases are strictly required for the MVP launch.
