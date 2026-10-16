-- Feature 2: nationality of the guest on hotel booking requests
ALTER TABLE "hotel_bookings"
  ADD COLUMN IF NOT EXISTS "guest_nationality" VARCHAR(100);

-- Feature 3: how the tour price is displayed on the public site
--   PRICE         -> show the numeric price (default)
--   HIDDEN        -> show nothing
--   CUSTOM_LABEL  -> show the localized custom text stored in price_label_jsonb
ALTER TABLE "tours"
  ADD COLUMN IF NOT EXISTS "price_display_mode" VARCHAR(20) NOT NULL DEFAULT 'PRICE';

ALTER TABLE "tours"
  ADD COLUMN IF NOT EXISTS "price_label_jsonb" JSONB;

-- Feature 4: recurring booking rules per tour
-- Shape example:
-- {
--   "enabled": true,
--   "dailyCutoffTime": "18:00",       -- stop same-day bookings after this local time
--   "cutoffTimezone": "Africa/Cairo",
--   "blockedWeekdays": [0, 6],        -- 0=Sunday ... 6=Saturday
--   "blockedRanges": [                -- inclusive date ranges
--     { "start": "2027-01-01", "end": "2027-01-07", "reason": "New Year holiday" }
--   ]
-- }
ALTER TABLE "tours"
  ADD COLUMN IF NOT EXISTS "booking_rules_jsonb" JSONB;
