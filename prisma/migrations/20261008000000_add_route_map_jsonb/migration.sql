-- AlterTable
ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "route_map_jsonb" JSONB;
