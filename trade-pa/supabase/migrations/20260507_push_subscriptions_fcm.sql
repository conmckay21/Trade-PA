-- Migration: extend push_subscriptions for hybrid Web Push + FCM support
-- Date: 2026-05-07
-- Purpose: Allow native Android (FCM token) subscriptions alongside existing Web Push

-- 1. Add type column ('web' or 'fcm'), default 'web' for existing rows
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'web'
    CHECK (type IN ('web', 'fcm'));

-- 2. Add fcm_token column (nullable, only used when type='fcm')
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS fcm_token text;

-- 3. Make web-push columns nullable (FCM rows don't have endpoint/p256dh/auth)
ALTER TABLE push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL;

-- p256dh and auth might already be nullable but make sure
ALTER TABLE push_subscriptions
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

-- 4. Constraint: web rows must have endpoint; fcm rows must have fcm_token
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_payload_check;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_payload_check CHECK (
    (type = 'web' AND endpoint IS NOT NULL)
    OR
    (type = 'fcm' AND fcm_token IS NOT NULL)
  );

-- 5. Unique index for FCM tokens per user (one device = one token; if it changes, upsert)
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_fcm_unique
  ON push_subscriptions (user_id, fcm_token)
  WHERE type = 'fcm';

-- 6. Existing web push unique index (user_id, endpoint) likely already exists
--    but ensure it's scoped to type='web' so it doesn't collide with FCM rows
DROP INDEX IF EXISTS push_subscriptions_user_id_endpoint_key;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_web_unique
  ON push_subscriptions (user_id, endpoint)
  WHERE type = 'web';

-- 7. Index for type filtering (used by send.js to fan out efficiently)
CREATE INDEX IF NOT EXISTS push_subscriptions_user_type_idx
  ON push_subscriptions (user_id, type);
