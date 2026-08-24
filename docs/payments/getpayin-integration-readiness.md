# GetPayIn payment integration readiness

Status: **prepared but intentionally disabled**

The selected provider is the Egyptian GetPayIn payment-link product at
`https://pay.getpayin.com/`. It is not the unrelated stablecoin product named
PayIn. GetPayIn publicly confirms payment links, real-time status tracking, and
support for USD, EUR, and EGP, but does not publish its merchant REST API or
webhook signature contract publicly.

## Implemented platform boundary

- `PAYMENT_PROVIDER=GETPAYIN` selects the provider boundary.
- `GET /api/payments/readiness` exposes only non-secret readiness state.
- Checkout input is generated server-side from the immutable booking invoice.
- Server-issued UUIDs are embedded in success and cancel callback URLs.
- The customer API key and webhook secret never reach the browser.
- Webhook routes must match the active provider name.
- Raw request bodies are retained for future signature verification.
- Webhook events are stored and processed idempotently.
- Captured amount and currency must exactly match the pending payment record.
- Production remains fail-closed until the official contract is reviewed.

## Merchant onboarding material required from GetPayIn

Obtain all of the following from the GetPayIn onboarding team. Do not infer
these values from browser traffic or examples from another payment provider.

1. Sandbox and production API base URLs.
2. Merchant/account identifier and separate sandbox/production API keys.
3. Authentication scheme and required request headers.
4. Create-payment-link endpoint, request schema, response schema, and TTL.
5. Supported currency/minor-unit rules for USD, EUR, and EGP.
6. Idempotency header/field behavior and retention window.
7. Success/cancel redirect rules and returned query parameters.
8. Webhook URL registration procedure.
9. Webhook signature header, algorithm, canonical payload, timestamp tolerance,
   secret rotation procedure, retry policy, and stable event identifier.
10. Complete event/status mapping, including paid, pending, failed, expired,
    cancelled, refunded, partially paid, and chargeback/dispute states.
11. Query/reconciliation endpoint for recovering missed webhooks.
12. Expire/cancel payment-link endpoint.
13. Full and partial refund endpoints and asynchronous refund events.
14. Rate limits, timeout guidance, error codes, maintenance/status channel, and
    support escalation contacts.
15. PCI DSS responsibility matrix, 3-D Secure behavior, refund policy, and
    settlement/reconciliation reports.

Store the official files under `docs/vendor/getpayin/` after removing secrets.
The contract version must then be recorded in `GETPAYIN_CONTRACT_VERSION`.

## Environment contract

```dotenv
PAYMENT_PROVIDER=DISABLED
PUBLIC_API_URL=https://dunastravel-backend-seven.vercel.app
GETPAYIN_MODE=sandbox
GETPAYIN_API_BASE_URL=
GETPAYIN_API_KEY=
GETPAYIN_WEBHOOK_SECRET=
GETPAYIN_MERCHANT_ID=
GETPAYIN_CONTRACT_VERSION=
```

Keep `PAYMENT_PROVIDER=DISABLED` in production until sandbox creation,
redirect, signed webhook, duplicate webhook, timeout, refund, and reconciliation
tests all pass. Enabling the provider is a separate production change.

## Go-live gates

- [ ] Official API and webhook documents received and reviewed.
- [ ] Sandbox merchant account and test instruments provisioned.
- [ ] Provider adapter maps the exact documented contract.
- [ ] Webhook signature fixtures pass positive and negative tests.
- [ ] Duplicate and out-of-order webhook tests pass.
- [ ] Amount/currency mismatch tests pass.
- [ ] Hosted payment redirect tested on mobile and desktop.
- [ ] Failed, cancelled, and expired payment recovery tested.
- [ ] Refund and reconciliation runbooks tested by finance/admin roles.
- [ ] Secrets stored in Vercel, not source control.
- [ ] Production webhook registered over HTTPS.
- [ ] Monitoring and support alerts enabled.
- [ ] `PAYMENT_PROVIDER=GETPAYIN` enabled only after approval.

