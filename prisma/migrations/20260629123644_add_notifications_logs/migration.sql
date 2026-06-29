-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CUSTOMER_ACKNOWLEDGMENT', 'INTERNAL_SALES_ALERT');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'EXHAUSTED');

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "origin_reference_code" VARCHAR(50) NOT NULL,
    "origin_entity_type" VARCHAR(50) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "provider_response_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_delivery_logs_origin_reference_code_idx" ON "notification_delivery_logs"("origin_reference_code");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_status_idx" ON "notification_delivery_logs"("status");
