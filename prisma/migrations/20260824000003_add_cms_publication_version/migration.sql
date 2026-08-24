CREATE TYPE "CmsBlockStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "cms_blocks"
  ADD COLUMN "status" "CmsBlockStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Blocks predate draft/public separation and were already public. Keep their existing
-- visibility; newly created blocks default to DRAFT.
UPDATE "cms_blocks" SET "status" = 'PUBLISHED';

CREATE INDEX "cms_blocks_status_updated_at_idx" ON "cms_blocks"("status", "updated_at");
