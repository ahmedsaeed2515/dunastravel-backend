-- CreateEnum
CREATE TYPE "TailorMadeInquiryStatus" AS ENUM ('NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED');

-- CreateTable
CREATE TABLE "tailor_made_inquiries" (
    "id" TEXT NOT NULL,
    "reference_code" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "preferred_language" VARCHAR(10) NOT NULL,
    "destinations" TEXT[],
    "start_date" DATE,
    "end_date" DATE,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "budget_amount" DECIMAL(10,2),
    "budget_currency" VARCHAR(10),
    "notes" TEXT,
    "status" "TailorMadeInquiryStatus" NOT NULL DEFAULT 'NEWLY_RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tailor_made_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tailor_made_inquiries_reference_code_key" ON "tailor_made_inquiries"("reference_code");

-- CreateIndex
CREATE INDEX "tailor_made_inquiries_reference_code_idx" ON "tailor_made_inquiries"("reference_code");

-- CreateIndex
CREATE INDEX "tailor_made_inquiries_status_idx" ON "tailor_made_inquiries"("status");

-- CreateIndex
CREATE INDEX "tailor_made_inquiries_created_at_idx" ON "tailor_made_inquiries"("created_at");
