-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'HANDED_OFF', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatLeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('user', 'assistant', 'system', 'staff', 'tool');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('COMPANY', 'FAQ', 'BOOKING_POLICY', 'CANCELLATION_POLICY', 'PAYMENT_INFO', 'VISA_GUIDANCE', 'DESTINATION_INFO', 'SAFETY_ADVICE', 'TRANSPORTATION', 'HOTELS', 'CUSTOM_TOURS', 'INCLUSIONS_EXCLUSIONS', 'CONTACT_SUPPORT', 'GENERAL');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_configs" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'anthropic',
    "model" VARCHAR(100) NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_public_enabled" BOOLEAN NOT NULL DEFAULT true,
    "encrypted_api_key" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 1024,
    "request_timeout_ms" INTEGER NOT NULL DEFAULT 15000,
    "retry_count" INTEGER NOT NULL DEFAULT 2,
    "default_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "supported_languages" TEXT[] DEFAULT ARRAY['en', 'ar', 'es', 'pt', 'it']::TEXT[],
    "system_instructions" TEXT NOT NULL,
    "sales_personality" TEXT,
    "tone_of_voice" VARCHAR(100),
    "safety_instructions" TEXT,
    "fallback_message" TEXT NOT NULL,
    "escalation_message" TEXT NOT NULL,
    "welcome_messages" JSONB,
    "suggested_questions" JSONB,
    "lead_capture_rules" JSONB,
    "human_handoff_rules" JSONB,
    "knowledge_settings" JSONB,
    "tour_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id" TEXT NOT NULL,
    "public_session_id" VARCHAR(100) NOT NULL,
    "user_id" TEXT,
    "customer_id" TEXT,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "channel" VARCHAR(50) NOT NULL DEFAULT 'web',
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_staff_id" TEXT,
    "visitor_name" VARCHAR(255),
    "visitor_email" VARCHAR(255),
    "visitor_phone" VARCHAR(50),
    "visitor_nationality" VARCHAR(100),
    "travel_preferences" JSONB,
    "budget_range" VARCHAR(100),
    "pax_count" INTEGER,
    "children_count" INTEGER,
    "preferred_destinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "travel_dates" VARCHAR(100),
    "trip_duration" VARCHAR(50),
    "summary" TEXT,
    "lead_score" INTEGER NOT NULL DEFAULT 0,
    "lead_status" "ChatLeadStatus" NOT NULL DEFAULT 'NEW',
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "utm_source" VARCHAR(100),
    "utm_medium" VARCHAR(100),
    "utm_campaign" VARCHAR(100),
    "referrer" VARCHAR(500),
    "current_page" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "handed_off_at" TIMESTAMP(3),

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ChatMessageRole" NOT NULL DEFAULT 'user',
    "text_content" TEXT NOT NULL,
    "structured_content" JSONB,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "provider" VARCHAR(50),
    "model" VARCHAR(100),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "is_error" BOOLEAN NOT NULL DEFAULT false,
    "error_category" VARCHAR(100),
    "moderation_status" VARCHAR(50) NOT NULL DEFAULT 'PASSED',
    "knowledge_sources" JSONB,
    "recommended_tour_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommended_destinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "knowledge_base_items" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "category" "KnowledgeCategory" NOT NULL DEFAULT 'GENERAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'PUBLISHED',
    "source" VARCHAR(255),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validity_start" TIMESTAMP(3),
    "validity_end" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0.00,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "is_success" BOOLEAN NOT NULL DEFAULT true,
    "error_category" VARCHAR(100),
    "conversation_id" TEXT,
    "session_id" TEXT,
    "endpoint" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_public_session_id_key" ON "chat_conversations"("public_session_id");
CREATE INDEX IF NOT EXISTS "chat_conversations_status_idx" ON "chat_conversations"("status");
CREATE INDEX IF NOT EXISTS "chat_conversations_lead_status_idx" ON "chat_conversations"("lead_status");
CREATE INDEX IF NOT EXISTS "chat_conversations_locale_idx" ON "chat_conversations"("locale");
CREATE INDEX IF NOT EXISTS "chat_conversations_created_at_idx" ON "chat_conversations"("created_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_public_session_id_idx" ON "chat_conversations"("public_session_id");

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "chat_messages_role_idx" ON "chat_messages"("role");
CREATE INDEX IF NOT EXISTS "chat_messages_created_at_idx" ON "chat_messages"("created_at");

CREATE INDEX IF NOT EXISTS "knowledge_base_items_category_idx" ON "knowledge_base_items"("category");
CREATE INDEX IF NOT EXISTS "knowledge_base_items_locale_idx" ON "knowledge_base_items"("locale");
CREATE INDEX IF NOT EXISTS "knowledge_base_items_status_idx" ON "knowledge_base_items"("status");
CREATE INDEX IF NOT EXISTS "knowledge_base_items_priority_idx" ON "knowledge_base_items"("priority");

CREATE INDEX IF NOT EXISTS "ai_usage_logs_provider_idx" ON "ai_usage_logs"("provider");
CREATE INDEX IF NOT EXISTS "ai_usage_logs_model_idx" ON "ai_usage_logs"("model");
CREATE INDEX IF NOT EXISTS "ai_usage_logs_is_success_idx" ON "ai_usage_logs"("is_success");
CREATE INDEX IF NOT EXISTS "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
