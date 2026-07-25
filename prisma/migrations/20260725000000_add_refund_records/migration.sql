-- CreateEnum: RefundStatus
DO $$ BEGIN
    CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: refund_records
CREATE TABLE IF NOT EXISTS "refund_records" (
    "id" TEXT NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "provider_refund_id" VARCHAR(255),
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "actor_id" TEXT,
    "actor_role" TEXT,
    "reason" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refund_records_idempotency_key_key" ON "refund_records"("idempotency_key");
CREATE INDEX IF NOT EXISTS "refund_records_payment_id_idx" ON "refund_records"("payment_id");
CREATE INDEX IF NOT EXISTS "refund_records_status_idx" ON "refund_records"("status");

-- ForeignKeys
ALTER TABLE "refund_records" DROP CONSTRAINT IF EXISTS "refund_records_payment_id_fkey";
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
