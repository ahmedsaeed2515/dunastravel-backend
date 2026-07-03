-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('AGENCY', 'CORPORATE', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('USER', 'COMPANY');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaEntityType" AS ENUM ('TOUR', 'GENERAL');

-- CreateEnum
CREATE TYPE "MediaProvenance" AS ENUM ('UPLOADED', 'SEEDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'PAID';
ALTER TYPE "BookingStatus" ADD VALUE 'PARTIALLY_PAID';
ALTER TYPE "BookingStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "BookingStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'COMPANY';
ALTER TYPE "UserRole" ADD VALUE 'AGENT';

-- DropIndex
DROP INDEX "bookings_reference_code_idx";

-- DropIndex
DROP INDEX "invoices_invoice_number_idx";

-- DropIndex
DROP INDEX "tailor_made_inquiries_reference_code_idx";

-- DropIndex
DROP INDEX "tours_slug_idx";

-- DropIndex
DROP INDEX "users_email_idx";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "assignee_id" TEXT,
ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "passengers" ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "nationality" VARCHAR(100),
ADD COLUMN     "passport_expiry" DATE,
ADD COLUMN     "passport_number" VARCHAR(100);

-- AlterTable
ALTER TABLE "tour_images" ADD COLUMN     "is_video" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "video_url" TEXT;

-- AlterTable
ALTER TABLE "tour_itineraries" ADD COLUMN     "activities_jsonb" JSONB,
ADD COLUMN     "hotels_jsonb" JSONB,
ADD COLUMN     "notes_jsonb" JSONB,
ADD COLUMN     "transportation_jsonb" JSONB;

-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "age_restrictions" VARCHAR(100),
ADD COLUMN     "cancellation_policy_jsonb" JSONB,
ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "departure_time" VARCHAR(50),
ADD COLUMN     "difficulty_level" VARCHAR(50),
ADD COLUMN     "excluded_services_jsonb" JSONB,
ADD COLUMN     "hotel_info_jsonb" JSONB,
ADD COLUMN     "included_services_jsonb" JSONB,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
ADD COLUMN     "meeting_point" VARCHAR(255),
ADD COLUMN     "pickup_locations_jsonb" JSONB,
ADD COLUMN     "region" VARCHAR(100),
ADD COLUMN     "remaining_seats" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "return_time" VARCHAR(50),
ADD COLUMN     "season_pricing_jsonb" JSONB,
ADD COLUMN     "seo_description" TEXT,
ADD COLUMN     "seo_title" VARCHAR(255),
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "terms_jsonb" JSONB,
ADD COLUMN     "transportation_jsonb" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" JSONB,
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "customer_number" VARCHAR(50),
ADD COLUMN     "customer_source" VARCHAR(50),
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "emergency_contact" JSONB,
ADD COLUMN     "family_members" JSONB,
ADD COLUMN     "future_commission_plan" VARCHAR(100),
ADD COLUMN     "future_wallet_id" VARCHAR(100),
ADD COLUMN     "gender" VARCHAR(50),
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_vip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketing_consent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nationality" VARCHAR(100),
ADD COLUMN     "passport_number" VARCHAR(100),
ADD COLUMN     "phone_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferred_currency" VARCHAR(10) DEFAULT 'USD',
ADD COLUMN     "preferred_destination" VARCHAR(100),
ADD COLUMN     "preferred_language" VARCHAR(10) DEFAULT 'en',
ADD COLUMN     "preferred_travel_type" VARCHAR(100),
ADD COLUMN     "referral_source" VARCHAR(100),
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "reset_token" VARCHAR(255),
ADD COLUMN     "reset_token_exp" TIMESTAMP(3),
ADD COLUMN     "segments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "travel_companions" JSONB,
ADD COLUMN     "verify_token" VARCHAR(255);

-- DropEnum
DROP TYPE "InquiryStatus";

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "reference_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "company_type" "CompanyType" NOT NULL DEFAULT 'AGENCY',
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "website" VARCHAR(255),
    "address" JSONB,
    "primary_contact" JSONB,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "payment_terms" VARCHAR(50) DEFAULT 'NET_30',
    "contract_start_date" DATE,
    "contract_end_date" DATE,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "segments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "note_type" VARCHAR(50) NOT NULL DEFAULT 'INTERNAL',
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_documents" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "document_type" VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    "title" VARCHAR(255) NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_activity_logs" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(255) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_reviews" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "reviewer_name" VARCHAR(255) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tour_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_activity_logs" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(255) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "provider_name" VARCHAR(100) NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "entity_type" "MediaEntityType" NOT NULL,
    "entity_id" VARCHAR(50),
    "provenance" "MediaProvenance" NOT NULL,
    "alt_text" VARCHAR(255),
    "uploaded_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "method" VARCHAR(100) NOT NULL,
    "transaction_id" VARCHAR(255),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "is_refund" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_activity_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(255) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_notes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_attachments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "owner_type" "WalletOwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "reference_type" VARCHAR(50) NOT NULL,
    "reference_id" TEXT,
    "description" VARCHAR(255),
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" VARCHAR(255) NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "payload" JSONB,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_reference_code_key" ON "companies"("reference_code");

-- CreateIndex
CREATE INDEX "companies_company_type_idx" ON "companies"("company_type");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "companies_deleted_at_idx" ON "companies"("deleted_at");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_idx" ON "customer_notes"("customer_id");

-- CreateIndex
CREATE INDEX "customer_notes_user_id_idx" ON "customer_notes"("user_id");

-- CreateIndex
CREATE INDEX "customer_notes_is_pinned_idx" ON "customer_notes"("is_pinned");

-- CreateIndex
CREATE INDEX "customer_documents_customer_id_idx" ON "customer_documents"("customer_id");

-- CreateIndex
CREATE INDEX "customer_activity_logs_customer_id_idx" ON "customer_activity_logs"("customer_id");

-- CreateIndex
CREATE INDEX "tour_reviews_tour_id_idx" ON "tour_reviews"("tour_id");

-- CreateIndex
CREATE INDEX "tour_reviews_rating_idx" ON "tour_reviews"("rating");

-- CreateIndex
CREATE INDEX "tour_reviews_deleted_at_idx" ON "tour_reviews"("deleted_at");

-- CreateIndex
CREATE INDEX "tour_activity_logs_tour_id_idx" ON "tour_activity_logs"("tour_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_public_id_key" ON "media_assets"("public_id");

-- CreateIndex
CREATE INDEX "media_assets_entity_type_entity_id_idx" ON "media_assets"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "media_assets_deleted_at_idx" ON "media_assets"("deleted_at");

-- CreateIndex
CREATE INDEX "media_assets_provider_name_idx" ON "media_assets"("provider_name");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "booking_activity_logs_booking_id_idx" ON "booking_activity_logs"("booking_id");

-- CreateIndex
CREATE INDEX "booking_notes_booking_id_idx" ON "booking_notes"("booking_id");

-- CreateIndex
CREATE INDEX "booking_attachments_booking_id_idx" ON "booking_attachments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_owner_type_owner_id_key" ON "wallets"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_booking_id_key" ON "commissions"("booking_id");

-- CreateIndex
CREATE INDEX "commissions_company_id_idx" ON "commissions"("company_id");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "bookings_assignee_id_idx" ON "bookings"("assignee_id");

-- CreateIndex
CREATE INDEX "bookings_company_id_idx" ON "bookings"("company_id");

-- CreateIndex
CREATE INDEX "bookings_priority_idx" ON "bookings"("priority");

-- CreateIndex
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");

-- CreateIndex
CREATE INDEX "tours_country_idx" ON "tours"("country");

-- CreateIndex
CREATE INDEX "tours_city_idx" ON "tours"("city");

-- CreateIndex
CREATE INDEX "tours_status_idx" ON "tours"("status");

-- CreateIndex
CREATE INDEX "tours_is_featured_idx" ON "tours"("is_featured");

-- CreateIndex
CREATE INDEX "tours_deleted_at_idx" ON "tours"("deleted_at");

-- CreateIndex
CREATE INDEX "users_customer_number_idx" ON "users"("customer_number");

-- CreateIndex
CREATE INDEX "users_is_vip_idx" ON "users"("is_vip");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activity_logs" ADD CONSTRAINT "customer_activity_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activity_logs" ADD CONSTRAINT "customer_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_reviews" ADD CONSTRAINT "tour_reviews_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_activity_logs" ADD CONSTRAINT "tour_activity_logs_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activity_logs" ADD CONSTRAINT "booking_activity_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activity_logs" ADD CONSTRAINT "booking_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attachments" ADD CONSTRAINT "booking_attachments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "users_customer_number_key" ON "users"("customer_number");