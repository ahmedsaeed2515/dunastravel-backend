-- Every departure must receive an explicit capacity from its owning domain flow.
-- Existing rows retain their stored values, so this is forward-safe for non-empty databases.
ALTER TABLE "tour_availabilities"
  ALTER COLUMN "total_capacity" DROP DEFAULT,
  ALTER COLUMN "remaining_seats" DROP DEFAULT;
