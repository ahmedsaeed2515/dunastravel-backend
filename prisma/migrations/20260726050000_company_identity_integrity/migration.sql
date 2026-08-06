DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM companies
    WHERE deleted_at IS NULL AND email IS NOT NULL
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce company email integrity: duplicate active emails exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM companies
    WHERE deleted_at IS NULL AND tax_id IS NOT NULL
    GROUP BY LOWER(tax_id)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce company tax ID integrity: duplicate active tax IDs exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "companies_active_email_ci_key"
  ON "companies" (LOWER("email"))
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "companies_active_tax_id_ci_key"
  ON "companies" (LOWER("tax_id"))
  WHERE "deleted_at" IS NULL AND "tax_id" IS NOT NULL;
