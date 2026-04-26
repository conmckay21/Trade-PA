-- Soft-delete holding bay (14-day buffer) — Phase 1: schema
-- 2026-04-26
--
-- Add deleted_at + deleted_cascade_id columns to every user-facing data
-- table. Reads filter `WHERE deleted_at IS NULL`. Cascading deletes share
-- the same cascade_id so restores can bring back exactly the set that was
-- deleted together (and not anything separately deleted before/after).
--
-- Hard-delete cron sweeps rows where deleted_at < NOW() - INTERVAL '14 days'.
-- See companion migration: soft_delete_holding_bay_cron.sql.
--
-- OUT of scope intentionally:
--   - subscriptions, addon_purchases, plan_limits — billing record
--   - usage_events, pa_error_log, anomaly_events, rate_limit_counters,
--     user_abuse_state — telemetry/abuse infra
--   - email/accounting/push connections — auth state
--   - team_members — has its own archived_at pattern from workers/subs
--     unification, leave as-is
--   - user_settings/onboarding/ai_context/pa_memories — config/state
--   - companies/company_members/invites — multi-tenant infra

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customers', 'enquiries', 'jobs', 'job_cards', 'job_notes',
    'job_photos', 'job_drawings', 'job_workers',
    'invoices', 'expenses', 'mileage_logs', 'time_logs', 'materials',
    'stock_items',
    'cis_statements', 'subcontractor_payments', 'daywork_sheets',
    'variation_orders', 'purchase_orders', 'purchase_order_items',
    'compliance_docs', 'trade_certificates', 'worker_documents',
    'rams_documents', 'documents',
    'reminders', 'customer_contacts', 'call_logs', 'user_commands'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_cascade_id UUID', t);
    -- Partial indexes — only index the rows we care about (deleted ones)
    -- so the index stays tiny and live-row reads aren't affected.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (deleted_at) WHERE deleted_at IS NOT NULL',
      'idx_' || t || '_deleted_at', t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (deleted_cascade_id) WHERE deleted_cascade_id IS NOT NULL',
      'idx_' || t || '_cascade_id', t
    );
  END LOOP;
END $$;
