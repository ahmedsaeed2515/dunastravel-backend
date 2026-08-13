-- CreateIndex
CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_category_idx" ON "tours"("status", "is_active", "deleted_at", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_country_idx" ON "tours"("status", "is_active", "deleted_at", "country");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_city_idx" ON "tours"("status", "is_active", "deleted_at", "city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_is_featured_idx" ON "tours"("status", "is_active", "deleted_at", "is_featured");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_deleted_at_status_created_at_idx" ON "bookings"("deleted_at", "status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_deleted_at_tour_id_created_at_idx" ON "bookings"("deleted_at", "tour_id", "created_at");
