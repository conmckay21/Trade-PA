-- Migration: sync_plan_limits_to_tier_config
-- Date: 2026-04-24
--
-- Brings the plan_limits table into alignment with TIER_CONFIG in App.jsx.
-- Required because check_usage_allowance() reads plan_limits as the source
-- of truth for rate limiting, but that table had stale caps from earlier
-- pricing experiments.
--
-- Before:
--   trial:           500 convos / 18000s (5h)
--   solo:            500 convos / 18000s (5h)
--   solo_founding:   500 convos / 18000s (5h)
--   team:            1500 convos / 54000s (15h)
--   pro:             2500 convos / 90000s (25h)
--   pro_solo:        (missing — fell through to unlimited)
--   business:        (missing — fell through to unlimited)
--
-- After:
--   trial:           50 convos / 1800s   (0.5h)
--   solo:            100 convos / 3600s  (1h)
--   solo_founding:   100 convos / 3600s  (1h)  — founding bonus is price, not caps
--   pro_solo:        200 convos / 10800s (3h)  — INSERT
--   team:            400 convos / 14400s (4h)
--   business:        800 convos / 28800s (8h)  — RENAMED from 'pro'
--
-- Verified: subscriptions table has zero rows. No live users affected.
--
-- Code mapping (App.jsx normalizeTier helper):
--   legacy 'pro'           → 'business'
--   legacy 'solo_founding' → 'solo' (with founding price flag)
--
-- This migration renames the existing 'pro' row to 'business' (preserves
-- created_at history rather than DELETE+INSERT) and inserts a new
-- 'pro_solo' row.

BEGIN;

-- 1. UPDATE: tighten existing rows
UPDATE plan_limits
SET monthly_conversations = 50,
    monthly_handsfree_seconds = 1800,
    updated_at = NOW()
WHERE plan_code = 'trial';

UPDATE plan_limits
SET monthly_conversations = 100,
    monthly_handsfree_seconds = 3600,
    updated_at = NOW()
WHERE plan_code = 'solo';

UPDATE plan_limits
SET monthly_conversations = 100,
    monthly_handsfree_seconds = 3600,
    updated_at = NOW()
WHERE plan_code = 'solo_founding';

UPDATE plan_limits
SET monthly_conversations = 400,
    monthly_handsfree_seconds = 14400,
    updated_at = NOW()
WHERE plan_code = 'team';

-- 2. RENAME 'pro' → 'business' + tighten caps
--    Preserves created_at and any other metadata. Code's normalizeTier
--    already handled this rename one-way; the DB now matches.
UPDATE plan_limits
SET plan_code = 'business',
    display_name = 'Business',
    monthly_conversations = 800,
    monthly_handsfree_seconds = 28800,
    user_limit = 10,
    updated_at = NOW()
WHERE plan_code = 'pro';

-- 3. INSERT new pro_solo plan
--    Sort order between solo and team. Inherits rate limits from solo.
INSERT INTO plan_limits (
    plan_code,
    display_name,
    monthly_conversations,
    monthly_handsfree_seconds,
    user_limit,
    priority_support,
    rate_limit_per_minute,
    rate_limit_per_hour,
    rate_limit_per_day,
    handsfree_max_session_seconds,
    sort_order,
    is_active
)
SELECT
    'pro_solo',
    'Pro Solo',
    200,
    10800,  -- 3 hours
    1,
    priority_support,
    rate_limit_per_minute,
    rate_limit_per_hour,
    rate_limit_per_day,
    handsfree_max_session_seconds,
    sort_order + 1,  -- between solo and team
    true
FROM plan_limits
WHERE plan_code = 'solo'
ON CONFLICT (plan_code) DO UPDATE
SET monthly_conversations = EXCLUDED.monthly_conversations,
    monthly_handsfree_seconds = EXCLUDED.monthly_handsfree_seconds,
    user_limit = EXCLUDED.user_limit,
    updated_at = NOW();

-- 4. Bump team's sort_order so pro_solo sits between solo and team
UPDATE plan_limits
SET sort_order = sort_order + 10,
    updated_at = NOW()
WHERE plan_code IN ('team', 'business');

-- 5. Sanity check — verify final state matches spec
DO $$
DECLARE
    expected RECORD;
    actual_convos INTEGER;
    actual_hf INTEGER;
BEGIN
    FOR expected IN
        SELECT * FROM (VALUES
            ('trial',         50,  1800),
            ('solo',          100, 3600),
            ('solo_founding', 100, 3600),
            ('pro_solo',      200, 10800),
            ('team',          400, 14400),
            ('business',      800, 28800)
        ) AS t(plan_code, convos, hf)
    LOOP
        SELECT monthly_conversations, monthly_handsfree_seconds
          INTO actual_convos, actual_hf
        FROM plan_limits
        WHERE plan_code = expected.plan_code;

        IF actual_convos IS NULL THEN
            RAISE EXCEPTION 'Migration failed: plan_code % missing', expected.plan_code;
        END IF;
        IF actual_convos != expected.convos OR actual_hf != expected.hf THEN
            RAISE EXCEPTION 'Migration failed for %: got (%, %), expected (%, %)',
                expected.plan_code, actual_convos, actual_hf,
                expected.convos, expected.hf;
        END IF;
    END LOOP;
END $$;

COMMIT;
