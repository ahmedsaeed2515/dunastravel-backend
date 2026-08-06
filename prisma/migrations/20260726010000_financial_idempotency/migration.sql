-- Refuse to hide pre-existing ledger corruption. If this migration stops here,
-- reconcile the duplicate business references before retrying it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM wallet_transactions
    WHERE reference_id IS NOT NULL
    GROUP BY wallet_id, reference_type, reference_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate wallet transaction business references exist; reconcile them before applying this migration';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_business_reference_key
  ON wallet_transactions (wallet_id, reference_type, reference_id);

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
