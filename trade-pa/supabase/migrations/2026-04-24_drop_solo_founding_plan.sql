-- Drop the solo_founding plan — concept retired.
-- Verified: subscriptions table has zero rows, so no live users on this plan.
DELETE FROM plan_limits WHERE plan_code = 'solo_founding';
