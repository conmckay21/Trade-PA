-- Applied via Supabase MCP on 2026-05-18
-- Track which expiry warning thresholds we've already pushed, to avoid
-- spamming the user every day until they renew.
ALTER TABLE public.compliance_docs
  ADD COLUMN IF NOT EXISTS last_warning_at DATE,
  ADD COLUMN IF NOT EXISTS last_warning_days INTEGER;

ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS last_warning_at DATE,
  ADD COLUMN IF NOT EXISTS last_warning_days INTEGER;
