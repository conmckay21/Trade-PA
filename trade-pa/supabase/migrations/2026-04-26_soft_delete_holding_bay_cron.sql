-- Soft-delete holding bay — Phase 2: nightly hard-delete cron
-- 2026-04-26
--
-- After 14 days in the holding bay, rows are permanently removed. Runs at
-- 03:30 UTC nightly (low-traffic window). Uses pg_cron which ships with
-- Supabase by default.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function that sweeps every soft-deleted table. Wrapped in a function so
-- it's a single named target the cron can call (and we can run manually
-- for testing without copy-pasting 29 DELETE statements).
CREATE OR REPLACE FUNCTION public.purge_expired_soft_deletes()
RETURNS TABLE(table_name text, rows_purged bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  n bigint;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DELETE FROM %I WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL ''14 days''',
      t
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      table_name := t;
      rows_purged := n;
      RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_soft_deletes IS
  'Hard-deletes rows soft-deleted >14 days ago across all holding-bay tables. Returns per-table purge counts. Scheduled by pg_cron at 03:30 UTC nightly.';

-- Schedule it. Drop existing job by name first so re-running this migration
-- is idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('purge_soft_deletes_nightly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'purge_soft_deletes_nightly',
  '30 3 * * *',  -- 03:30 UTC daily
  $$ SELECT public.purge_expired_soft_deletes(); $$
);
