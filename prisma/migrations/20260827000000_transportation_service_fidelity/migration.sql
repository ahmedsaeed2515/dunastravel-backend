ALTER TABLE "transportation_services"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "vehicle_category" VARCHAR(50),
  ADD COLUMN "vehicle_type" VARCHAR(100),
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "doors" INTEGER,
  ADD COLUMN "transmission" VARCHAR(50),
  ADD COLUMN "hero_image_url" VARCHAR(2048),
  ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pickup_instructions" TEXT,
  ADD COLUMN "dropoff_instructions" TEXT,
  ADD COLUMN "features_jsonb" JSONB,
  ADD COLUMN "hero_media_id" VARCHAR(50);

ALTER TABLE "transportation_bookings"
  ADD COLUMN "notes" TEXT;

ALTER TABLE "transportation_services"
  ADD CONSTRAINT "transportation_services_capacity_positive"
  CHECK ("capacity" IS NULL OR "capacity" > 0);

CREATE INDEX "transportation_services_active_type_idx"
  ON "transportation_services"("is_active", "service_type");

-- The following rows are the vetted fleet metadata found in the legacy
-- catalog. Prices are deliberately not overwritten: its historic per-day
-- figures conflict with the active quote prices and require an admin decision.
WITH fleet(id, vehicle_category, vehicle_type, capacity, doors, transmission, is_private, hero_image_url, description, features_jsonb) AS (
  VALUES
    ('tr-bus-1', 'bus', 'VIP Tour Bus', 50, 2, 'AUTO', false, '/imgs/transportation/bus1.jpeg', 'Premier 50-seater VIP tour bus equipped with modern entertainment, reclining leather seats, and an on-board restroom for long-distance travel.', '["AC","WiFi","Professional Driver","Restroom","Leather Seats","Luggage Compartment"]'::jsonb),
    ('tr-bus-2', 'bus', 'Tour Coach', 45, 2, 'AUTO', false, '/imgs/transportation/bus2.jpeg', 'Comfortable long-haul coach bus for large tour groups travelling between Cairo, Luxor, Aswan, and Hurghada.', '["AC","WiFi","Professional Driver","Restroom","Audio System","Reclining Seats"]'::jsonb),
    ('tr-bus-3', 'bus', 'Mercedes Tour Bus', 50, 2, 'AUTO', false, '/imgs/transportation/bus3.jpeg', 'Mercedes-Benz luxury coach with individual USB charging ports, climate control, and premium comfort.', '["AC","WiFi","Professional Driver","Restroom","Leather Seats","USB Chargers"]'::jsonb),
    ('tr-bus-4', 'bus', 'VIP Tour Coach', 48, 2, 'AUTO', false, '/imgs/transportation/bus4.jpeg', 'Spacious tourist coach with air-ride suspension and experienced multi-lingual drivers.', '["AC","WiFi","Professional Driver","Restroom","Premium Audio","Reclining Seats"]'::jsonb),
    ('tr-bus-5', 'bus', 'Grand Touring Bus', 50, 2, 'AUTO', false, '/imgs/transportation/bus5.jpeg', 'Grand touring bus for luxury multi-day journeys with multimedia and high-speed Wi-Fi.', '["AC","WiFi","Professional Driver","Restroom","LED TV","USB Chargers"]'::jsonb),
    ('tr-bus-6', 'bus', 'Coach Bus', 45, 2, 'AUTO', false, '/imgs/transportation/bus6.jpeg', 'Reliable 45-seat coach for corporate retreats and large family excursions.', '["AC","WiFi","Professional Driver","Audio System","Luggage Compartment"]'::jsonb),
    ('tr-bus-7', 'bus', 'Executive Bus', 48, 2, 'AUTO', false, '/imgs/transportation/bus7.jpeg', 'Executive bus with panoramic windows, mini fridge, and refreshment counter.', '["AC","WiFi","Professional Driver","Restroom","Leather Seats","Mini Fridge"]'::jsonb),
    ('tr-coaster-1', 'coaster', 'Toyota Coaster', 26, 2, 'AUTO', false, '/imgs/transportation/costar.jpeg', 'Mid-sized 26-seater bus for medium groups, airport transfers, and day excursions.', '["AC","WiFi","Professional Driver","Audio System","Spacious Legroom"]'::jsonb),
    ('tr-coaster-2', 'coaster', 'Toyota Coaster VIP', 22, 2, 'AUTO', false, '/imgs/transportation/costar1.jpeg', 'VIP Coaster with captain seats and extra legroom for discerning travellers.', '["AC","WiFi","Professional Driver","Leather Seats","USB Chargers","Premium Audio"]'::jsonb),
    ('tr-private-1', 'private', 'Luxury Sedan & SUV', 4, 4, 'AUTO', true, '/imgs/transportation/privte.jpeg', 'Private air-conditioned luxury vehicle with chauffeur for airport pickups, city tours, and custom itineraries.', '["AC","GPS","Airbag","WiFi","Professional Driver","Leather Seats","Mineral Water"]'::jsonb)
)
UPDATE "transportation_services" AS service
SET
  "vehicle_category" = fleet.vehicle_category,
  "vehicle_type" = fleet.vehicle_type,
  "capacity" = fleet.capacity,
  "doors" = fleet.doors,
  "transmission" = fleet.transmission,
  "is_private" = fleet.is_private,
  "hero_image_url" = fleet.hero_image_url,
  "description" = fleet.description,
  "features_jsonb" = fleet.features_jsonb
FROM fleet
WHERE service.id = fleet.id;
