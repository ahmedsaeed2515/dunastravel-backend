-- Additive Migration: Content Capabilities Enhancements (P2-013 to P2-018)

-- 1. TourReviews Enhancements
ALTER TABLE "tour_reviews" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "tour_reviews" ADD COLUMN IF NOT EXISTS "booking_id" TEXT;
ALTER TABLE "tour_reviews" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS "idx_tour_reviews_user_id" ON "tour_reviews"("user_id");
CREATE INDEX IF NOT EXISTS "idx_tour_reviews_booking_id" ON "tour_reviews"("booking_id");
CREATE INDEX IF NOT EXISTS "idx_tour_reviews_status" ON "tour_reviews"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "tour_reviews_booking_id_key" ON "tour_reviews"("booking_id") WHERE "booking_id" IS NOT NULL;

-- 2. BlogArticles Enhancements
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "excerpt_jsonb" JSONB;
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "seo_title_jsonb" JSONB;
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "seo_description_jsonb" JSONB;
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "cover_image" TEXT;
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "author" VARCHAR(100);
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100);
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'DRAFT';
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);
ALTER TABLE "blog_articles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_blog_articles_slug" ON "blog_articles"("slug");
CREATE INDEX IF NOT EXISTS "idx_blog_articles_status" ON "blog_articles"("status");
CREATE INDEX IF NOT EXISTS "idx_blog_articles_is_published" ON "blog_articles"("is_published");
CREATE INDEX IF NOT EXISTS "idx_blog_articles_category" ON "blog_articles"("category");
CREATE INDEX IF NOT EXISTS "idx_blog_articles_deleted_at" ON "blog_articles"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_blog_articles_is_published_published_at" ON "blog_articles"("is_published", "published_at");

-- 3. FaqItems Enhancements
ALTER TABLE "faq_items" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_faq_items_category" ON "faq_items"("category");
CREATE INDEX IF NOT EXISTS "idx_faq_items_sort_order" ON "faq_items"("sort_order");
CREATE INDEX IF NOT EXISTS "idx_faq_items_is_published" ON "faq_items"("is_published");
CREATE INDEX IF NOT EXISTS "idx_faq_items_deleted_at" ON "faq_items"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_faq_items_is_published_sort_order" ON "faq_items"("is_published", "sort_order");
