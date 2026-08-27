-- Email delivery is not currently reliable enough to be an account-access gate.
-- Keep this setting mutable so an administrator can re-enable verification after
-- Resend/domain configuration has been verified in production.
INSERT INTO "system_settings" ("id", "key", "value", "created_at", "updated_at")
VALUES (
  'auth-require-email-verification',
  'AUTH_REQUIRE_EMAIL_VERIFICATION',
  'false'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key")
DO UPDATE SET
  "value" = EXCLUDED."value",
  "updated_at" = CURRENT_TIMESTAMP;
