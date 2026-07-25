-- Additive migration for Prompt 07: Analytics, AI, Journey Maps, Audit, and Notifications

-- Map JourneyRoute table to journey_routes with snake_case columns if not already mapped
CREATE TABLE IF NOT EXISTS "journey_routes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "points_jsonb" JSONB NOT NULL,
    "tour_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_routes_pkey" PRIMARY KEY ("id")
);

-- Foreign key for journey_routes -> tours
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'journey_routes_tour_id_fkey'
    ) THEN
        ALTER TABLE "journey_routes" ADD CONSTRAINT "journey_routes_tour_id_fkey" 
        FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Indexes for journey_routes
CREATE INDEX IF NOT EXISTS "journey_routes_tour_id_idx" ON "journey_routes"("tour_id");
CREATE INDEX IF NOT EXISTS "journey_routes_created_at_idx" ON "journey_routes"("created_at");

-- Performance indexes for notification delivery logs
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_origin_ref_status_idx" ON "notification_delivery_logs"("origin_reference_code", "status");
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_created_at_idx" ON "notification_delivery_logs"("created_at");

-- Performance indexes for audit logs
CREATE INDEX IF NOT EXISTS "audit_logs_actor_role_action_idx" ON "audit_logs"("actor_role", "action");
