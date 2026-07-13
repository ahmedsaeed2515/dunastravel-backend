-- Fix: Double-payment initiation guard (Finding 9)
-- Adds the sessionUrl column so existing Stripe checkout URLs can be replayed,
-- and a partial unique index to enforce at the DB level that only one PENDING
-- Payment record can exist per booking at any time.

-- 1. Add the session_url column (nullable — existing rows get NULL, admin payments stay NULL).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS session_url TEXT;

-- 2. Partial unique index: only one row with status='PENDING' is allowed per booking_id.
--    Prisma cannot express partial indexes in schema.prisma directly, so we add it here.
--    This closes the race condition: if two concurrent requests both pass the
--    application-level check and race to INSERT, the DB will reject the second INSERT
--    with a unique violation (Prisma error code P2002).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_booking
  ON payments (booking_id)
  WHERE (status = 'PENDING');
