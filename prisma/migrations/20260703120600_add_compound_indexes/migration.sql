-- CreateIndex
CREATE INDEX "bookings_status_created_at_idx" ON "bookings"("status", "created_at");

-- CreateIndex
CREATE INDEX "bookings_tour_id_created_at_idx" ON "bookings"("tour_id", "created_at");
