const fs = require('fs');

const apiInventory = require('./api-inventory.json');
const swaggerSpec = require('./swagger-spec.json');
const schemaPrisma = fs.readFileSync('./prisma/schema.prisma', 'utf8');

const outputLines = [];

outputLines.push('# Complete Technical Audit Report: Dunas Travel Backend\n');

outputLines.push('## 1. Project Overview');
outputLines.push('- **Purpose and domain**: Dunas Travel is a production-ready luxury travel platform backend. It serves as the foundation for booking tailor-made tours, managing itineraries, processing invoices, and handling customer inquiries.');
outputLines.push('- **Full tech stack**:');
outputLines.push('  - Language: TypeScript (Strict Mode)');
outputLines.push('  - Framework: NestJS (Express-based)');
outputLines.push('  - Database: PostgreSQL');
outputLines.push('  - ORM/Query Builder: Prisma ORM');
outputLines.push('  - Caching/Redis: cache-manager, cache-manager-redis-store, ioredis');
outputLines.push('  - Message Queues/Event Bus: @nestjs/event-emitter (Node\'s EventEmitter2)');
outputLines.push('  - Task Schedulers: @nestjs/schedule');
outputLines.push('  - Containerization: Docker (via Dockerfile and docker-compose.yml)');
outputLines.push('- **Folder/module structure**:');
outputLines.push('  - `src/common/`: Shared infrastructure (guards, decorators, filters, interceptors, utils).');
outputLines.push('  - `src/config/`: Configuration setup (e.g. environment variables validation via Joi).');
outputLines.push('  - `src/health/`: Health check endpoints (`/live`, `/ready`).');
outputLines.push('  - `src/prisma/`: PrismaService module.');
outputLines.push('  - `src/scripts/`: Backend scripts and utilities.');
outputLines.push('  - `src/modules/`: Feature modules (auth, tours, bookings, invoices, inquiries, notifications, payments, etc.). Each follows a Domain-Driven Design pattern with controllers, services, and optionally adapters.');
outputLines.push('- **Entry point and startup**: The application boots from `src/main.ts`. It loads `AppModule` which orchestrates imports of config, prisma, and all feature modules. The global prefix is set to `/api`. It uses HTTP-only cookie JWTs, validation pipes, global exception filters, helmet, and rate limiting (throttler).\n');

outputLines.push('## 2. Complete API Inventory\n');

const endpointsByModule = {};
apiInventory.forEach(endpoint => {
  if (!endpointsByModule[endpoint.module]) endpointsByModule[endpoint.module] = [];
  endpointsByModule[endpoint.module].push(endpoint);
});

for (const [mod, endpoints] of Object.entries(endpointsByModule)) {
  outputLines.push(`### Module: ${mod}`);
  outputLines.push('| Method | Route | Controller/Handler | Required Auth / Roles |');
  outputLines.push('| --- | --- | --- | --- |');
  endpoints.forEach(ep => {
    let swaggerPath = ep.route.replace('/api', '');
    swaggerPath = swaggerPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    
    let authReq = 'Public';
    let pathInfo = swaggerSpec.paths[swaggerPath];
    if (pathInfo && pathInfo[ep.method.toLowerCase()]) {
      const op = pathInfo[ep.method.toLowerCase()];
      if (op.security && op.security.length > 0) {
        authReq = 'Auth Required (JWT)';
      }
    }
    if (ep.route.includes('/admin')) {
      authReq = 'Auth Required (ADMIN)';
    }

    outputLines.push(`| ${ep.method} | \`${ep.route}\` | \`${ep.controller}.${ep.action}\` | ${authReq} |`);
  });
  outputLines.push('\n');
}

outputLines.push('*Note: Most endpoints undergo global rate limiting (`ThrottlerGuard`). All accept JSON bodies/query strings defined by DTOs (using class-validator).*');

outputLines.push('## 3. Database Layer');
outputLines.push('The database is PostgreSQL, accessed via Prisma ORM.');

const models = [...schemaPrisma.matchAll(/model ([a-zA-Z0-9_]+) {/g)].map(m => m[1]);
outputLines.push(`**Models/Entities**: \n- ${models.join(', ')}`);

outputLines.push('\n**Relationships Overview**:');
outputLines.push('- **User** 1:N **Booking** (Customer bookings) and **User** 1:N **Booking** (Assigned Admin).');
outputLines.push('- **User** N:1 **Company** (Agents/Corporate users belong to a company).');
outputLines.push('- **Tour** 1:N **Booking** (Tours have many bookings).');
outputLines.push('- **Tour** 1:N **TourItinerary**, **TourImage**, **TourReview** (Cascade deletions enforced).');
outputLines.push('- **Booking** 1:1 **Invoice**, 1:1 **BillingInfo**, 1:1 **Commission**.');
outputLines.push('- **Booking** 1:N **Passenger**, **Payment**, **BookingActivityLog**.');
outputLines.push('- **Wallet** 1:N **WalletTransaction**.');
outputLines.push('- No direct foreign keys for generic logs like `NotificationDeliveryLog` or `AuditLog` (uses polymorphic string fields for loose coupling).');
outputLines.push('- Soft deletes (`deleted_at`) implemented across major entities (`User`, `Tour`, `Company`, `Booking`, etc.).\n');

outputLines.push('## 4. Payment System Deep-Dive');
outputLines.push('- **Integrated Gateways**: Stripe (`stripe.adapter.ts`).');
outputLines.push('- **Gateway Usage**: `StripeAdapter` implements `IPaymentGatewayPort`. It provides `createSession()`, `verifyAndParseWebhook()`, and `refund()`.');
outputLines.push('- **Supported Methods**: Primarily Card (via Stripe Checkout Sessions).');
outputLines.push('- **Full Lifecycle**:');
outputLines.push('  1. `initiatePayment`: System creates a Stripe session & internal `Payment` record in `PENDING` state.');
outputLines.push('  2. Client completes checkout at Stripe URL.');
outputLines.push('  3. Webhook receives `checkout.session.completed`.');
outputLines.push('  4. `processWebhook` is called. It uses `Serializable` transaction isolation for idempotency. Status moves to `COMPLETED` / `CAPTURED`.');
outputLines.push('  5. Related Booking is marked as `PAID`.');
outputLines.push('  6. If 30 min passes without payment, Cron job sets it to `EXPIRED`.');
outputLines.push('- **Webhook Handling**: Handled at `payments/webhook/stripe`. Signature verified using `STRIPE_WEBHOOK_SECRET`. Idempotency via `ProcessedWebhookEvent` table.');
outputLines.push('- **Secrets**: Loaded from env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). Fallbacks to `_placeholder` (should flag as risky if deployed with defaults).');
outputLines.push('- **Currency Handling**: Amount in DB is Decimal (USD). Stripe expects cents, handled via `Math.round(amountUsd * 100)`.');
outputLines.push('- **Limitations (Missing Validations/Risks)**: Partial refunds are explicitly unsupported (throws `BadRequestException` if requested). Wait times or offline payments handling not extensively built.\n');

outputLines.push('## 5. Request Lifecycle / Architecture Flow');
outputLines.push('`Route` ➔ `Middleware (Helmet/Compression/CORS)` ➔ `Global Guards (Throttler, JwtAuth, Roles)` ➔ `Interceptors` ➔ `Controller` ➔ `Service (Business Logic)` ➔ `Prisma (Database)` ➔ `Response`.');
outputLines.push('Events emitted post-transaction commit using `EventEmitter2` (e.g. `booking.created`), which are picked up by completely decoupled Consumers (like `NotificationsModule`).\n');

outputLines.push('## 6. Third-Party Integrations (Non-Payment)');
outputLines.push('- **Email**: Resend API (`RESEND_API_KEY`). Handled by `NotificationsModule`. Uses bounded retries natively.');
outputLines.push('- **Media/Storage**: Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).');
outputLines.push('- **Currency Rates**: OpenExchangeRates (`OPENEXCHANGERATES_APP_ID`).');
outputLines.push('- **Monitoring**: Sentry (`SENTRY_DSN`) and Prometheus endpoints (`/metrics`).');
outputLines.push('- **AI**: Anthropic (`ANTHROPIC_API_KEY`) for itinerary/customer analysis.\n');

outputLines.push('## 7. Security Overview');
outputLines.push('- **Auth**: JWT tokens stored securely in `HttpOnly` cookies. Refresh token rotation supported.');
outputLines.push('- **Hashing**: bcrypt for passwords.');
outputLines.push('- **Validation**: strict validation with `class-validator` (whitelist true).');
outputLines.push('- **CORS**: Enforced using `CORS_ALLOWED_ORIGINS`.');
outputLines.push('- **Limits**: strict rate-limiting via `@nestjs/throttler` (default: 100 requests / 60 seconds).\n');

outputLines.push('## 8. Error Handling & Logging');
outputLines.push('- **Errors**: Global exception filters format error responses consistently. Sentry catches unhandled exceptions.');
outputLines.push('- **Logging**: Structured JSON logging (NestJS built-in wrapped with Winston), correlation IDs added for request tracing. `AuditLog` table tracks significant business mutations (Admin actions, etc.).\n');

outputLines.push('## 9. Final Summary Map');
outputLines.push('```mermaid');
outputLines.push('graph TD');
outputLines.push('    Client -->|HTTP| NestJS_API');
outputLines.push('    NestJS_API -->|AuthGuard| AuthModule');
outputLines.push('    NestJS_API --> ToursModule');
outputLines.push('    NestJS_API --> BookingsModule');
outputLines.push('    BookingsModule -->|Emits booking.created| EventEmitter2');
outputLines.push('    EventEmitter2 --> NotificationsModule');
outputLines.push('    NotificationsModule -->|SMTP/HTTP| Resend');
outputLines.push('    BookingsModule --> PaymentsModule');
outputLines.push('    PaymentsModule <--> Stripe');
outputLines.push('    ToursModule --> Prisma');
outputLines.push('    BookingsModule --> Prisma');
outputLines.push('    PaymentsModule --> Prisma');
outputLines.push('    Prisma --> PostgreSQL');
outputLines.push('    MediaModule --> Cloudinary');
outputLines.push('```');

fs.writeFileSync('C:\\Users\\Ahmed Saeed\\.gemini\\antigravity\\brain\\29ed40a8-7038-4bbf-87e9-22898fe57419\\audit_report.md', outputLines.join('\n'));
console.log('Done!');
