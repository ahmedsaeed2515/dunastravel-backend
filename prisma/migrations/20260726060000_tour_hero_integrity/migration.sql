DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tour_images
    WHERE is_hero = TRUE
    GROUP BY tour_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tour hero integrity: multiple hero images exist for a tour';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "tour_images_one_hero_per_tour_key"
  ON "tour_images" ("tour_id")
  WHERE "is_hero" = TRUE;
