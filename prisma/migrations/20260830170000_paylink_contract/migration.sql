-- Preserve historical rows while refusing to apply an unsafe uniqueness
-- constraint if duplicate provider identities already exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payments
    WHERE provider IS NOT NULL AND provider_payment_id IS NOT NULL
    GROUP BY provider, provider_payment_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate payment provider identities must be reconciled before applying PayLink migration';
  END IF;
END $$;

ALTER TABLE payments
  ADD COLUMN provider_auth_code VARCHAR(100),
  ADD COLUMN last_provider_check_at TIMESTAMP(3);

DROP INDEX IF EXISTS payments_provider_provider_payment_id_idx;
CREATE UNIQUE INDEX payments_provider_provider_payment_id_key
  ON payments(provider, provider_payment_id);
