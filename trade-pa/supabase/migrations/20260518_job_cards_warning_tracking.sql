-- Applied via Supabase MCP on 2026-05-18
-- Same dedup pattern as compliance_docs / worker_documents for annual jobs.
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS last_warning_at DATE,
  ADD COLUMN IF NOT EXISTS last_warning_days INTEGER;
