-- Migration: drop_founding_member_columns
-- Date: 2026-04-24
--
-- Retires the Founding Member programme entirely. All code paths that
-- read/wrote these columns (api/founding-slots.js, webhook.js metadata
-- handler, App.jsx normalizeTier shim, pricing.html banner, HelpCentre.jsx
-- article) have been removed in the Apr 24 deploy.
--
-- Apply ONLY after the founding-member-removal code is live in production.
-- If applied before, the Stripe webhook would attempt to write to dropped
-- columns on any new subscription and 4xx the request.
--
-- Verified pre-migration:
--   - subscriptions table has zero rows (no live users)
--   - idx_founding_member_slot will drop automatically with the column
--   - No other code paths reference these columns (full-repo grep clean)

ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS is_founding_member,
  DROP COLUMN IF EXISTS founding_member_slot_number,
  DROP COLUMN IF EXISTS founding_price_locked_until;
