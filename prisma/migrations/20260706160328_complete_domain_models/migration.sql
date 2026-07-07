-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "paid_amount_usd" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "tailor_made_inquiries" ADD COLUMN     "assignee_id" TEXT,
ADD COLUMN     "follow_up_at" TIMESTAMP(3),
ADD COLUMN     "internal_note" TEXT;

-- AlterTable
ALTER TABLE "tour_reviews" ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suspend_reason" TEXT,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "verify_token_exp" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tour_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "discount_percent" DOUBLE PRECISION NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER NOT NULL,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_blocks" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL,
    "last_updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body_html" TEXT NOT NULL,
    "variables" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_favorites_user_id_idx" ON "tour_favorites"("user_id");

-- CreateIndex
CREATE INDEX "tour_favorites_tour_id_idx" ON "tour_favorites"("tour_id");

-- CreateIndex
CREATE UNIQUE INDEX "tour_favorites_user_id_tour_id_key" ON "tour_favorites"("user_id", "tour_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_code_idx" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_is_active_idx" ON "promotions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cms_blocks_key_key" ON "cms_blocks"("key");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");

-- CreateIndex
CREATE INDEX "tailor_made_inquiries_assignee_id_idx" ON "tailor_made_inquiries"("assignee_id");

-- CreateIndex
CREATE INDEX "tour_reviews_tour_id_is_published_idx" ON "tour_reviews"("tour_id", "is_published");

-- AddForeignKey
ALTER TABLE "tailor_made_inquiries" ADD CONSTRAINT "tailor_made_inquiries_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_favorites" ADD CONSTRAINT "tour_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_favorites" ADD CONSTRAINT "tour_favorites_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
