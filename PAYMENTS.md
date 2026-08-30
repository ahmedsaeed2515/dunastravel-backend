# Payments module

The NestJS payments module owns server-authoritative hosted checkout, PayLink webhook processing, callback reconciliation, refunds, and payment state transitions. `IPaymentGatewayPort` keeps provider types at the adapter boundary; `GetPayInGatewayAdapter` uses the official `@getpayin/paylink` SDK.

## PayLink flow

1. An authenticated booking owner calls `POST /api/payments/initiate` with only a booking UUID.
2. The backend validates ownership and its immutable Dunas invoice, creates or reuses one local payment attempt, and sends a decimal string to `invoices.create()`.
3. The PayLink `invoice_id`, allowlisted hosted URL, and provider `expires_at` are persisted.
4. Browser callback fields are posted to `POST /api/payments/callback/getpayin`. Their signature is verified server-side, then `payments.checkStatus()` supplies financial truth.
5. Signed provider webhooks at `POST /api/payments/webhook/getpayin` atomically update Payment, Booking, Dunas Invoice, and the lifecycle-aware event fingerprint.
6. A SUPER_ADMIN may issue full or partial refunds. Every refund calls `payments.refund()` with a stable idempotency key and is persisted in `RefundRecord`.

## State and idempotency

Payment attempts preserve history (`PENDING`, `CAPTURED`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `REFUNDED`). The database permits one pending attempt per booking, one local idempotency key, and one `(provider, providerPaymentId)` identity. PayLink webhook deduplication hashes provider, invoice, event, status, and signature so `paid` followed by `refunded` remains valid while exact replays have one logical effect.

Partial refunds keep the original payment captured, record the refunded amount separately, expose `PARTIALLY_REFUNDED` as provider state, and proportionally reduce B2B commission. A cumulative full refund closes the payment, booking, invoice, promotion redemption, and commission.

The ordinary customer flow never collects card data and never loads the PayLink SDK or credentials in a browser.
