-- How the room nightly rate is displayed on the public site
--   PRICE         -> show the numeric price (default)
--   HIDDEN        -> show nothing
--   CUSTOM_LABEL  -> show the localized custom text stored in price_label_jsonb
ALTER TABLE "hotel_rooms"
  ADD COLUMN IF NOT EXISTS "price_display_mode" VARCHAR(20) NOT NULL DEFAULT 'PRICE';

ALTER TABLE "hotel_rooms"
  ADD COLUMN IF NOT EXISTS "price_label_jsonb" JSONB;
