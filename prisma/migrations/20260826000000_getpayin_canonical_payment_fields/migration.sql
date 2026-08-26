-- Add nullable canonical fields. Existing ledger rows are intentionally left
-- untouched: method/transaction_id remain the historical source values.
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "provider_environment" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "merchant_reference" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "provider_payment_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "attempt_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "provider_status" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "provider_status_raw" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failure_code" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "failure_message" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payments_provider_merchant_reference_idx"
  ON "payments" ("provider", "merchant_reference");
CREATE INDEX IF NOT EXISTS "payments_provider_provider_payment_id_idx"
  ON "payments" ("provider", "provider_payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_unique"
  ON "payments" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_booking_attempt_number_unique"
  ON "payments" ("booking_id", "attempt_number")
  WHERE "attempt_number" IS NOT NULL;
