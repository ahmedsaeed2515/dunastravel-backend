-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "event_name" VARCHAR(100) NOT NULL,
    "session_id" VARCHAR(100),
    "user_id" VARCHAR(100),
    "interface_slug" VARCHAR(100),
    "tour_slug" VARCHAR(100),
    "booking_ref" VARCHAR(50),
    "locale" VARCHAR(10) DEFAULT 'en',
    "pathname" VARCHAR(255),
    "referrer" VARCHAR(500),
    "utm_source" VARCHAR(100),
    "utm_medium" VARCHAR(100),
    "utm_campaign" VARCHAR(100),
    "device_category" VARCHAR(20) DEFAULT 'desktop',
    "properties" JSONB,
    "occurred_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable Bookings
ALTER TABLE "bookings" ADD COLUMN "analytics_session_id" VARCHAR(100),
ADD COLUMN "origin_interface_slug" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_event_id_key" ON "analytics_events"("event_id");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_idx" ON "analytics_events"("event_name");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_tour_slug_idx" ON "analytics_events"("tour_slug");

-- CreateIndex
CREATE INDEX "analytics_events_interface_slug_idx" ON "analytics_events"("interface_slug");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_created_at_idx" ON "analytics_events"("event_name", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_tour_slug_event_name_created_at_idx" ON "analytics_events"("tour_slug", "event_name", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_interface_slug_event_name_created_at_idx" ON "analytics_events"("interface_slug", "event_name", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_event_name_created_at_idx" ON "analytics_events"("session_id", "event_name", "created_at");
