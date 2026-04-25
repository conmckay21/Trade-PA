-- Migration: reminders_related_context
-- Date: 2026-04-24
-- Purpose: Add related_type + related_id columns to the reminders table so
--          reminder emails can include context about what the reminder is about
--          (job details, invoice amount + status, customer phone, enquiry source, etc).
--
-- Safe to run against production:
--   - Columns are NULLABLE — existing rows get NULL, no default value rewrites.
--   - IF NOT EXISTS guards make the migration idempotent (rerunning is safe).
--   - No locks on existing rows. Zero-downtime for the reminders table.
--   - Backwards compatible — the cron (/api/cron/process-reminders.js) keeps
--     working unchanged until the follow-up code deploy lands. Reminders with
--     NULL related_type render the existing minimal email template.
--
-- Why no foreign key constraints:
--   - related_id points at one of four different tables (job_cards, invoices,
--     customers, enquiries) depending on related_type. A single FK can't
--     express that.
--   - Reminder context is best-effort: if the related row is deleted later,
--     we want the reminder to still fire — it just falls back to the plain
--     template. A FK would either forbid the delete or cascade-delete the
--     reminder, neither of which is what we want.
--   - At render time (cron), we do a SELECT; if no row matches, we render
--     the plain template and move on.

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS related_type text
    CHECK (related_type IS NULL OR related_type IN ('job', 'invoice', 'customer', 'enquiry'));

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS related_id text;
  -- Using text (not uuid) because:
  --   1) job_cards.id, invoices.id, customers.id, enquiries.id are all uuid
  --      but are stored as uuid OR text elsewhere in the app depending on
  --      table — keeping this text avoids cast headaches at lookup time.
  --   2) Lookup is always `.eq("id", related_id)` against the matched table,
  --      PostgREST coerces as needed.

-- Index on (related_type, related_id) so the cron's per-reminder enrichment
-- lookup (SELECT ... FROM <target_table> WHERE id = ?) is fast. The index
-- itself isn't on those target tables — they already have PK indexes on id.
-- This index is for any future query like "show me all reminders linked to
-- this specific invoice" (e.g. when an invoice is paid, auto-cancel related
-- reminders). Not used by the cron today, but cheap to create.
CREATE INDEX IF NOT EXISTS idx_reminders_related
  ON reminders (related_type, related_id)
  WHERE related_type IS NOT NULL;

-- Column comments for future-us and future-Claudes
COMMENT ON COLUMN reminders.related_type IS
  'Type of entity this reminder relates to: job, invoice, customer, enquiry. NULL for free-form reminders.';
COMMENT ON COLUMN reminders.related_id IS
  'ID of the related entity — points at job_cards.id, invoices.id, customers.id, or enquiries.id depending on related_type. Text-typed, no FK constraint (see migration notes).';

-- Sanity check — run this after the migration to confirm it landed:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'reminders' AND column_name IN ('related_type', 'related_id');
-- Expected: two rows, both text, both YES for nullable.
