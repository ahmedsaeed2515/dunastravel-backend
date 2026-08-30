# GetPayIn PayLink readiness

The provider contract is the checked-in `PayLink_Payment_Integration.postman_collection.json` plus the pinned official `@getpayin/paylink@0.1.1` SDK. The adapter is implemented and fails closed until backend credentials and registered HTTPS URLs are configured.

## Runtime configuration

```dotenv
PAYMENT_PROVIDER=GETPAYIN
GETPAYIN_MODE=sandbox
GETPAYIN_BASE_URL=https://pay.getpayin.com
GETPAYIN_AUTH_TOKEN=
GETPAYIN_HASH_TOKEN=
GETPAYIN_REDIRECT_URL=https://www.dunastravel.com/payment/return
GETPAYIN_WEBHOOK_URL=https://api.example.com/api/payments/webhook/getpayin
GETPAYIN_TIMEOUT_MS=30000
GETPAYIN_MAX_RETRIES=2
```

`GETPAYIN_AUTH_TOKEN` maps to SDK `publicToken`; `GETPAYIN_HASH_TOKEN` maps to SDK `hashToken`. Old `GETPAYIN_API_KEY`, `GETPAYIN_WEBHOOK_SECRET`, and `GETPAYIN_API_BASE_URL` are temporary semantic aliases only. Merchant ID and contract-version variables are obsolete.

Readiness reports `DISABLED`, `CONFIG_INCOMPLETE`, `CONFIGURED`, or `LIVE_CONFIGURED`. It never calls local configuration “verified.” `SANDBOX_VERIFIED` and `LIVE_VERIFIED` require recorded external transaction evidence.

## External go-live gates

- Create a Website integration in GetPayIn Dashboard → Settings → Payment Integrations.
- Register the exact customer origin, redirect URL, webhook URL, and supported invoice lifecycle events.
- Put Authentication Token and Hash Token only in the actual backend secret store.
- Apply the PayLink database migration.
- Execute and record sandbox success, decline, callback, webhook replay, missed-webhook reconciliation, full refund, and partial refund tests.
- Replace sandbox with live credentials only after provider approval and a controlled live verification.
