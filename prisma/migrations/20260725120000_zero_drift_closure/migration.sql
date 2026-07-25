-- Additive Migration: Zero-Drift Closure for Prompt 09
-- Synchronizes all replayed migration tables, indexes, FKs, and enums with prisma/schema.prisma

-- CreateEnums
DO $$ BEGIN
    CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TourAvailabilityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'SOLD_OUT', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TourDepartureStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'CLOSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TransportationBookingStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'PASSENGER_PICKED_UP', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'REFUND_PENDING', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'VOID', 'CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable tours (drop obsolete columns from early init migration)
ALTER TABLE "tours" DROP COLUMN IF EXISTS "capacity";
ALTER TABLE "tours" DROP COLUMN IF EXISTS "remaining_seats";

-- AlterTable bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(50);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "arrival_time" VARCHAR(20);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "booking_type" VARCHAR(20) NOT NULL DEFAULT 'BOOKING';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "departure_time" VARCHAR(20);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "inquiry_message" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "language" VARCHAR(10);

-- AlterTable companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tax_id" VARCHAR(100);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tier" VARCHAR(50);

-- AlterTable invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable tour_reviews
ALTER TABLE "tour_reviews" ADD COLUMN IF NOT EXISTS "admin_reply" TEXT;
UPDATE "tour_reviews" SET "status" = 'PENDING' WHERE "status" IS NULL;
ALTER TABLE "tour_reviews" ALTER COLUMN "status" SET NOT NULL;

-- AlterTable blog_articles
UPDATE "blog_articles" SET "status" = 'DRAFT' WHERE "status" IS NULL;
ALTER TABLE "blog_articles" ALTER COLUMN "status" SET NOT NULL;

-- CreateTable system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable tour_landing_pages
CREATE TABLE IF NOT EXISTS "tour_landing_pages" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'DESTINATION',
    "title_jsonb" JSONB NOT NULL,
    "subtitle_jsonb" JSONB,
    "description_jsonb" JSONB,
    "brief_jsonb" JSONB,
    "hero_image_url" TEXT,
    "hero_video_url" TEXT,
    "seo_title_jsonb" JSONB,
    "seo_description_jsonb" JSONB,
    "seo_keywords_jsonb" JSONB,
    "sections_jsonb" JSONB,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tour_landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable tour_landing_page_tours
CREATE TABLE IF NOT EXISTS "tour_landing_page_tours" (
    "id" TEXT NOT NULL,
    "landing_page_id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "custom_badge" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_landing_page_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable currency_rates
DROP TABLE IF EXISTS "CurrencyRate";
CREATE TABLE IF NOT EXISTS "currency_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rate_to_base" DECIMAL(65,30) NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");

CREATE UNIQUE INDEX IF NOT EXISTS "tour_landing_pages_slug_key" ON "tour_landing_pages"("slug");
CREATE INDEX IF NOT EXISTS "tour_landing_pages_status_idx" ON "tour_landing_pages"("status");
CREATE INDEX IF NOT EXISTS "tour_landing_pages_type_idx" ON "tour_landing_pages"("type");
CREATE INDEX IF NOT EXISTS "tour_landing_pages_is_active_idx" ON "tour_landing_pages"("is_active");
CREATE INDEX IF NOT EXISTS "tour_landing_pages_deleted_at_idx" ON "tour_landing_pages"("deleted_at");

CREATE INDEX IF NOT EXISTS "tour_landing_page_tours_landing_page_id_idx" ON "tour_landing_page_tours"("landing_page_id");
CREATE INDEX IF NOT EXISTS "tour_landing_page_tours_tour_id_idx" ON "tour_landing_page_tours"("tour_id");
CREATE INDEX IF NOT EXISTS "tour_landing_page_tours_sort_order_idx" ON "tour_landing_page_tours"("sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "tour_landing_page_tours_landing_page_id_tour_id_key" ON "tour_landing_page_tours"("landing_page_id", "tour_id");

CREATE UNIQUE INDEX IF NOT EXISTS "currency_rates_code_key" ON "currency_rates"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "blog_articles_slug_key" ON "blog_articles"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_tax_id_key" ON "companies"("tax_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transportation_bookings_reference_code_key" ON "transportation_bookings"("reference_code");
CREATE INDEX IF NOT EXISTS "transportation_bookings_user_id_idx" ON "transportation_bookings"("user_id");
CREATE INDEX IF NOT EXISTS "transportation_bookings_status_idx" ON "transportation_bookings"("status");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("created_at");
CREATE INDEX IF NOT EXISTS "users_name_idx" ON "users"("name");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_role_action_idx" ON "audit_logs"("actor_role", "action");

-- ForeignKeys
ALTER TABLE "tour_reviews" DROP CONSTRAINT IF EXISTS "tour_reviews_user_id_fkey";
ALTER TABLE "tour_reviews" ADD CONSTRAINT "tour_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tour_reviews" DROP CONSTRAINT IF EXISTS "tour_reviews_booking_id_fkey";
ALTER TABLE "tour_reviews" ADD CONSTRAINT "tour_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tour_landing_page_tours" DROP CONSTRAINT IF EXISTS "tour_landing_page_tours_landing_page_id_fkey";
ALTER TABLE "tour_landing_page_tours" ADD CONSTRAINT "tour_landing_page_tours_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "tour_landing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tour_landing_page_tours" DROP CONSTRAINT IF EXISTS "tour_landing_page_tours_tour_id_fkey";
ALTER TABLE "tour_landing_page_tours" ADD CONSTRAINT "tour_landing_page_tours_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transportation_bookings" DROP CONSTRAINT IF EXISTS "transportation_bookings_service_id_fkey";
ALTER TABLE "transportation_bookings" ADD CONSTRAINT "transportation_bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "transportation_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transportation_bookings" DROP CONSTRAINT IF EXISTS "transportation_bookings_user_id_fkey";
ALTER TABLE "transportation_bookings" ADD CONSTRAINT "transportation_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
