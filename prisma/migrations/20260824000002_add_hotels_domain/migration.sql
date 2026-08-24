ALTER TYPE "MediaEntityType" ADD VALUE IF NOT EXISTS 'HOTEL';

CREATE TABLE "hotels" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name_jsonb" JSONB NOT NULL,
  "description_jsonb" JSONB,
  "destination_slug" VARCHAR(100) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "stars" INTEGER NOT NULL,
  "rating" DECIMAL(3,2),
  "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
  "address_jsonb" JSONB,
  "phone" VARCHAR(50),
  "email" VARCHAR(255),
  "website" VARCHAR(2048),
  "amenities_jsonb" JSONB,
  "policies_jsonb" JSONB,
  "hero_media_id" VARCHAR(50),
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "hotels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotels_slug_key" UNIQUE ("slug")
);

CREATE TABLE "hotel_rooms" (
  "id" TEXT NOT NULL,
  "hotel_id" TEXT NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name_jsonb" JSONB NOT NULL,
  "description_jsonb" JSONB,
  "rate_per_night" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
  "meal_plan_jsonb" JSONB,
  "max_occupancy" INTEGER NOT NULL,
  "inventory" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_rooms_hotel_id_slug_key" UNIQUE ("hotel_id", "slug"),
  CONSTRAINT "hotel_rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "hotels_destination_slug_status_is_active_deleted_at_idx" ON "hotels"("destination_slug", "status", "is_active", "deleted_at");
CREATE INDEX "hotels_city_idx" ON "hotels"("city");
CREATE INDEX "hotels_deleted_at_idx" ON "hotels"("deleted_at");
CREATE INDEX "hotel_rooms_hotel_id_is_active_deleted_at_idx" ON "hotel_rooms"("hotel_id", "is_active", "deleted_at");
