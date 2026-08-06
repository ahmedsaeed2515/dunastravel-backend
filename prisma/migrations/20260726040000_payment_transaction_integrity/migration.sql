DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payments
    WHERE transaction_id IS NOT NULL
    GROUP BY transaction_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce payment transaction integrity: duplicate transaction_id values exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_id_unique
  ON payments (transaction_id)
  WHERE transaction_id IS NOT NULL;
