-- Scale prep: user_id indexes on hot tables (forensic audit Finding 1.2)
-- 2026-04-27
--
-- Every dashboard load filters by user_id. Without these indexes, every
-- read is a sequential scan. At 18 invoices that's instant; at 5,000 users
-- × 200 invoices = 1M rows, every dashboard load becomes a 1-3s table scan.
--
-- All indexes use WHERE deleted_at IS NULL so they perfectly match the
-- soft-delete auto-injected filter. Smaller, faster than full indexes.
--
-- Tables NOT included here:
--   - reminders — already has (user_id) and (user_id, fire_at) indexes
--   - materials — already has (user_id, paid) composite
--
-- NOTE: invoices/jobs/job_cards/etc don't have customer_id columns —
-- they store customer name as text. So FK-pair indexes for customer
-- relationships aren't applicable here. Today's holding-bay cascade
-- map needs adjustment too (separate fix).

CREATE INDEX IF NOT EXISTS idx_invoices_user_id_active
  ON invoices(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_user_id_active
  ON jobs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_cards_user_id_active
  ON job_cards(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id_active
  ON customers(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_user_id_active
  ON expenses(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id_active
  ON time_logs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mileage_logs_user_id_active
  ON mileage_logs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_docs_user_id_active
  ON compliance_docs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trade_certificates_user_id_active
  ON trade_certificates(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_enquiries_user_id_active
  ON enquiries(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id_active
  ON call_logs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id_active
  ON purchase_orders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_variation_orders_user_id_active
  ON variation_orders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daywork_sheets_user_id_active
  ON daywork_sheets(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_user_id_active
  ON stock_items(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_user_id_active
  ON subcontractor_payments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_user_id_active
  ON documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rams_documents_user_id_active
  ON rams_documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_worker_documents_user_id_active
  ON worker_documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_workers_user_id_active
  ON job_workers(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_notes_user_id_active
  ON job_notes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_photos_user_id_active
  ON job_photos(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_drawings_user_id_active
  ON job_drawings(user_id) WHERE deleted_at IS NULL;

-- Tables that DO have customer_id (small set)
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id
  ON customer_contacts(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_id
  ON call_logs(customer_id) WHERE deleted_at IS NULL;
