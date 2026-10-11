-- CreateTable
CREATE TABLE IF NOT EXISTS "seasons" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_jsonb" JSONB NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "room_season_pricings" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "rate_per_night" DECIMAL(10,2) NOT NULL,
    "single_supplement" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "child_rate" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "extra_bed_rate" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "board_basis" VARCHAR(50) NOT NULL DEFAULT 'BB',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_season_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "trip_accommodations" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "hotel_id" TEXT,
    "room_id" TEXT,
    "destination" VARCHAR(100) NOT NULL,
    "nights" INTEGER NOT NULL DEFAULT 1,
    "regime" VARCHAR(100) NOT NULL DEFAULT 'BB',
    "category_tier" VARCHAR(100),
    "price_supplement_usd" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes_jsonb" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_accommodations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "seasons_code_key" ON "seasons"("code");
CREATE INDEX IF NOT EXISTS "seasons_start_date_end_date_idx" ON "seasons"("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "seasons_is_active_idx" ON "seasons"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "room_season_pricings_room_id_season_id_key" ON "room_season_pricings"("room_id", "season_id");
CREATE INDEX IF NOT EXISTS "room_season_pricings_room_id_idx" ON "room_season_pricings"("room_id");
CREATE INDEX IF NOT EXISTS "room_season_pricings_season_id_idx" ON "room_season_pricings"("season_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trip_accommodations_tour_id_sort_order_idx" ON "trip_accommodations"("tour_id", "sort_order");
CREATE INDEX IF NOT EXISTS "trip_accommodations_hotel_id_idx" ON "trip_accommodations"("hotel_id");
CREATE INDEX IF NOT EXISTS "trip_accommodations_room_id_idx" ON "trip_accommodations"("room_id");

-- AddForeignKey
ALTER TABLE "room_season_pricings" ADD CONSTRAINT "room_season_pricings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_season_pricings" ADD CONSTRAINT "room_season_pricings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_accommodations" ADD CONSTRAINT "trip_accommodations_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_accommodations" ADD CONSTRAINT "trip_accommodations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trip_accommodations" ADD CONSTRAINT "trip_accommodations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
