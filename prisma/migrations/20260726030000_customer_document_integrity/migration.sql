DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "customer_documents"
    GROUP BY "media_asset_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce customer document integrity: duplicate media_asset_id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "booking_attachments"
    GROUP BY "media_asset_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce booking attachment integrity: duplicate media_asset_id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "customer_documents" cd
    INNER JOIN "booking_attachments" ba
      ON ba."media_asset_id" = cd."media_asset_id"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce media attachment integrity: an asset is linked as both a customer document and booking attachment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "customer_documents" cd
    LEFT JOIN "media_assets" ma ON ma."id" = cd."media_asset_id"
    WHERE ma."id" IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM "booking_attachments" ba
    LEFT JOIN "media_assets" ma ON ma."id" = ba."media_asset_id"
    WHERE ma."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce media attachment integrity: orphaned media references exist';
  END IF;
END $$;

ALTER TABLE "customer_documents"
ADD CONSTRAINT "customer_documents_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id")
REFERENCES "media_assets"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "booking_attachments"
ADD CONSTRAINT "booking_attachments_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id")
REFERENCES "media_assets"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "customer_documents_media_asset_id_key"
ON "customer_documents"("media_asset_id");

CREATE UNIQUE INDEX "booking_attachments_media_asset_id_key"
ON "booking_attachments"("media_asset_id");
