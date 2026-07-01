# Authentication & Security Policies

## JWT Lifecycle & Flow
1. **Login:** Users POST `/api/auth/login` (or `/api/auth/register`) to receive an `access_token` and `refresh_token` as strictly secured `HttpOnly` cookies.
2. **CSRF:** All state-changing requests require a Double-Submit Cookie CSRF pattern. Retrieve the token via `GET /api/auth/csrf` and send it via the `x-csrf-token` header.
3. **Guards:** Endpoints require `@UseGuards(JwtAuthGuard)` to parse the payload. Role authorization is handled strictly by `@RolesGuard(...)`.

## Rate Limit Policy (ThrottlerGuard)
Sensitive authentication endpoints enforce strict limits to prevent brute forcing and enumeration:
- `POST /api/auth/login`: 5 req / 60s
- `POST /api/auth/register`: 5 req / 60s
- `POST /api/auth/forgot-password`: 5 req / 60s
- `POST /api/auth/reset-password`: 5 req / 60s
- `POST /api/auth/verify-email`: 5 req / 60s
- `GET /api/bookings/:referenceCode`: 5 req / 60s
- `GET /api/invoices/:invoiceNumber`: 5 req / 60s

## Session Management
- `POST /api/auth/logout`: Invalidates the current refresh token and clears both cookies.
- `POST /api/auth/logout-all`: Invalidates *all* refresh tokens for the user across all devices and clears cookies.
- *(Note: `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id` were planned but have NOT been implemented in the codebase).*

## Role Matrix (Responses & Permissions)
- **USER (403 if missing):** Standard customer. Can manage own profile and view own bookings via `GET /api/bookings/me`.
- **COMPANY / AGENT (403 if missing):** Can access self-service endpoints (`GET /api/company/*`) which strictly scopes data to the `user.companyId` embedded in the JWT payload.
- **ADMIN (403 if missing):** Has access to standard `/api/admin/*` endpoints (users, companies, tours, bookings, media, currencies). Cannot approve commissions or assign roles above ADMIN.
- **SUPER_ADMIN (403 if missing):** God mode. Required for manual wallet transactions (`POST /api/admin/finance/wallets/transactions/manual`), commission status updates (`PATCH /api/admin/finance/commissions/:id/status`), and `AuditLog` read access.

## Audit Log Policy
The system automatically logs critical business and security actions to the `AuditLog` table:
- **USER_ROLE_CHANGED**: When an Admin updates another user's role via `PATCH /api/admin/users/:id`.
- **USER_DELETED**: When an Admin deletes a user.
- **COMMISSION_STATUS_CHANGED**: When a Super Admin approves or rejects a commission.
- **WALLET_TRANSACTION**: Manual wallet adjustments.
- **COMPANY_STATUS_CHANGED**: Suspensions or activations of B2B partners.
- **BOOKING_STATUS_CHANGED**: Cancellations or confirmations of high-value tours.
