-- Applied via Supabase MCP on 2026-05-18
-- Track which quote follow-up threshold (day 3 / day 7) was last sent.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS last_followup_at DATE,
  ADD COLUMN IF NOT EXISTS last_followup_days INTEGER;
