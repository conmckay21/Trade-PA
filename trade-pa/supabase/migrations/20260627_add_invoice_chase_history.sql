-- 20260627_add_invoice_chase_history.sql
--
-- Applied to the live database via the Supabase MCP migration
-- "add_invoice_chase_history" on 2026-06-27. Kept here as the source-of-record
-- copy for the repo. Safe to re-run: ADD COLUMN IF NOT EXISTS is a no-op once
-- the column exists.
--
-- Purpose: an append-only log of the real send date of every payment chase on an
-- invoice. Written at the moment each chase is sent, by BOTH chase paths:
--   * the in-app / Eve chase (chaseInvoiceSend in src/ai/AIAssistant.jsx)
--   * the automatic cron chaser (chaseOverdueInvoices in api/email-cron.js)
-- so the final notice email and the letter before action can list every prior
-- contact. A customer therefore cannot claim a final notice was the first they
-- heard about the debt.
--
-- Shape: jsonb array of objects, for example
--   [{"n":1,"label":"Payment reminder","at":"2026-05-29T09:00:00.000Z"},
--    {"n":2,"label":"Second reminder","at":"2026-06-05T09:00:00.000Z"}]
--
-- NOT NULL DEFAULT '[]' backfills every existing row in the same statement, so
-- application code never reads null (it still guards with || [] defensively).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS chase_history jsonb NOT NULL DEFAULT '[]'::jsonb;
