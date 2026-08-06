ALTER TABLE "transportation_bookings"
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "request_hash" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "transportation_bookings_user_idempotency_key"
  ON "transportation_bookings" ("user_id", "idempotency_key");
