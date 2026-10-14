-- Remove the trip-accommodation board basis / meal regime ("🍽️ BB") field
-- from the command of the tour rate sheet.

-- 1) Drop the relational column on trip_accommodations.
ALTER TABLE "trip_accommodations" DROP COLUMN IF EXISTS "regime";

-- 2) Strip the legacy "regime" / "boardBasis" keys from the JSONB rate-sheet rows
--    stored in tours.hotel_info_jsonb (both the "accommodation" and the newer
--    "accommodations" array shapes).
UPDATE "tours"
SET "hotel_info_jsonb" = jsonb_set(
      "hotel_info_jsonb",
      '{accommodation}',
      COALESCE(
        (
          SELECT jsonb_agg(elem - 'regime' - 'boardBasis')
          FROM jsonb_array_elements("hotel_info_jsonb" -> 'accommodation') AS elem
        ),
        '[]'::jsonb
      )
    )
WHERE "hotel_info_jsonb" IS NOT NULL
  AND jsonb_typeof("hotel_info_jsonb" -> 'accommodation') = 'array';

UPDATE "tours"
SET "hotel_info_jsonb" = jsonb_set(
      "hotel_info_jsonb",
      '{accommodations}',
      COALESCE(
        (
          SELECT jsonb_agg(elem - 'regime' - 'boardBasis')
          FROM jsonb_array_elements("hotel_info_jsonb" -> 'accommodations') AS elem
        ),
        '[]'::jsonb
      )
    )
WHERE "hotel_info_jsonb" IS NOT NULL
  AND jsonb_typeof("hotel_info_jsonb" -> 'accommodations') = 'array';
