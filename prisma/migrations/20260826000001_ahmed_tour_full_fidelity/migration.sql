-- Explicit Ahmed source fields. These are catalog presentation fields only;
-- no booking, payment, invoice, or audit relation is changed by this migration.
ALTER TABLE "tours"
  ADD COLUMN IF NOT EXISTS "subtitle_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "highlights_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "departure_info_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "source_code_jsonb" JSONB,
  ADD COLUMN IF NOT EXISTS "source_catalog_id" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "market" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "source_rating" DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS "source_review_count" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "tours_source_catalog_id_key"
  ON "tours" ("source_catalog_id")
  WHERE "source_catalog_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tours_source_catalog_id_idx"
  ON "tours" ("source_catalog_id");
