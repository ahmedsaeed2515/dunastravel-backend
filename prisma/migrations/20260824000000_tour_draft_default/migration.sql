-- New tours are unpublished until an authorized editor explicitly publishes them.
-- Existing rows are intentionally unchanged, so this is safe for non-empty databases.
ALTER TABLE "tours"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
