-- AlterTable
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "tour_id" TEXT;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "is_global" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "hotels_tour_id_key" ON "hotels"("tour_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hotels_is_global_idx" ON "hotels"("is_global");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hotels_tour_id_idx" ON "hotels"("tour_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hotels_tour_id_fkey'
  ) THEN
    ALTER TABLE "hotels" ADD CONSTRAINT "hotels_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
