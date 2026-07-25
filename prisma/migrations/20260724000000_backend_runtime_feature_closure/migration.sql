-- AlterEnum: TailorMadeInquiryStatus
ALTER TYPE "TailorMadeInquiryStatus" ADD VALUE IF NOT EXISTS 'QUOTED';
ALTER TYPE "TailorMadeInquiryStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "TailorMadeInquiryStatus" ADD VALUE IF NOT EXISTS 'CONVERTED_TO_BOOKING';

-- AlterTable: bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "availability_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "request_hash" VARCHAR(64);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guest_token_hash" VARCHAR(64);

-- CreateIndex: bookings_idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_idempotency_key_key" ON "bookings"("idempotency_key");

-- AlterTable: invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "total" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) NOT NULL DEFAULT 'USD';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "snapshot_jsonb" JSONB;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_id" TEXT;

-- AlterTable: tailor_made_inquiries
ALTER TABLE "tailor_made_inquiries" ADD COLUMN IF NOT EXISTS "quoted_amount_usd" DECIMAL(10,2);
ALTER TABLE "tailor_made_inquiries" ADD COLUMN IF NOT EXISTS "booking_id" TEXT;

-- CreateIndex: tailor_made_inquiries_booking_id
CREATE UNIQUE INDEX IF NOT EXISTS "tailor_made_inquiries_booking_id_key" ON "tailor_made_inquiries"("booking_id");

-- CreateTable: tour_availabilities
CREATE TABLE IF NOT EXISTS "tour_availabilities" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_capacity" INTEGER NOT NULL DEFAULT 30,
    "remaining_seats" INTEGER NOT NULL DEFAULT 30,
    "status" VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_availabilities_pkey" PRIMARY KEY ("id")
);

-- Add Check Constraints for Capacity Safety
ALTER TABLE "tour_availabilities" DROP CONSTRAINT IF EXISTS "chk_total_capacity_positive";
ALTER TABLE "tour_availabilities" ADD CONSTRAINT "chk_total_capacity_positive" CHECK ("total_capacity" > 0);

ALTER TABLE "tour_availabilities" DROP CONSTRAINT IF EXISTS "chk_remaining_seats_nonnegative";
ALTER TABLE "tour_availabilities" ADD CONSTRAINT "chk_remaining_seats_nonnegative" CHECK ("remaining_seats" >= 0);

ALTER TABLE "tour_availabilities" DROP CONSTRAINT IF EXISTS "chk_remaining_seats_max_capacity";
ALTER TABLE "tour_availabilities" ADD CONSTRAINT "chk_remaining_seats_max_capacity" CHECK ("remaining_seats" <= "total_capacity");

-- CreateTable: promotion_redemptions
CREATE TABLE IF NOT EXISTS "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT,
    "discount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transportation_services
CREATE TABLE IF NOT EXISTS "transportation_services" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "service_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "base_price_usd" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportation_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transportation_bookings
CREATE TABLE IF NOT EXISTS "transportation_bookings" (
    "id" TEXT NOT NULL,
    "reference_code" VARCHAR(20) NOT NULL,
    "service_id" TEXT NOT NULL,
    "user_id" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    "pickup_date" DATE NOT NULL,
    "pickup_time" VARCHAR(20),
    "pickup_location" VARCHAR(255) NOT NULL,
    "dropoff_location" VARCHAR(255) NOT NULL,
    "passenger_count" INTEGER NOT NULL DEFAULT 1,
    "luggage_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount_usd" DECIMAL(10,2) NOT NULL,
    "flight_number" VARCHAR(50),
    "driver_name" VARCHAR(100),
    "vehicle_type" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportation_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: blog_articles
CREATE TABLE IF NOT EXISTS "blog_articles" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title_jsonb" JSONB NOT NULL,
    "content_jsonb" JSONB NOT NULL,
    "cover_image" TEXT,
    "author" VARCHAR(100),
    "category" VARCHAR(100),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: faq_items
CREATE TABLE IF NOT EXISTS "faq_items" (
    "id" TEXT NOT NULL,
    "question_jsonb" JSONB NOT NULL,
    "answer_jsonb" JSONB NOT NULL,
    "category" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: currency_rates
CREATE TABLE IF NOT EXISTS "currency_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rate_to_base" DECIMAL(65,30) NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: journey_routes
CREATE TABLE IF NOT EXISTS "journey_routes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "points_jsonb" JSONB NOT NULL,
    "tour_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tour_availabilities_tour_id_idx" ON "tour_availabilities"("tour_id");
CREATE INDEX IF NOT EXISTS "tour_availabilities_date_idx" ON "tour_availabilities"("date");
CREATE INDEX IF NOT EXISTS "tour_availabilities_status_idx" ON "tour_availabilities"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "tour_availabilities_tour_id_date_key" ON "tour_availabilities"("tour_id", "date");

CREATE INDEX IF NOT EXISTS "promotion_redemptions_promotion_id_idx" ON "promotion_redemptions"("promotion_id");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_user_id_idx" ON "promotion_redemptions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "promotion_redemptions_booking_id_key" ON "promotion_redemptions"("booking_id");

-- ForeignKeys
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_availability_id_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "tour_availabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_payment_id_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tour_availabilities" DROP CONSTRAINT IF EXISTS "tour_availabilities_tour_id_fkey";
ALTER TABLE "tour_availabilities" ADD CONSTRAINT "tour_availabilities_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tailor_made_inquiries" DROP CONSTRAINT IF EXISTS "tailor_made_inquiries_booking_id_fkey";
ALTER TABLE "tailor_made_inquiries" ADD CONSTRAINT "tailor_made_inquiries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promotion_redemptions" DROP CONSTRAINT IF EXISTS "promotion_redemptions_promotion_id_fkey";
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promotion_redemptions" DROP CONSTRAINT IF EXISTS "promotion_redemptions_booking_id_fkey";
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promotion_redemptions" DROP CONSTRAINT IF EXISTS "promotion_redemptions_user_id_fkey";
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
