-- Workers/Subcontractors unification — Session 3 (FK cutover)
-- 2026-04-25
--
-- After this migration, the three FK constraints that previously referenced
-- workers.id / subcontractors.id now reference team_members.id. Any existing
-- payment rows (currently 1: the Lewis Skelton CIS payment) get their
-- subcontractor_id remapped from the legacy id to the corresponding
-- team_members.id via the source_table+source_id link Session 1 backfilled.
--
-- The legacy `workers` and `subcontractors` tables are LEFT IN PLACE but
-- marked as deprecated via SQL comment. They become read-only orphans
-- (nothing writes to them anymore) until Session 4 drops them entirely
-- after a sync period.
--
-- Pre-migration check (run these manually if paranoid):
--   SELECT COUNT(*) FROM subcontractor_payments sp
--     LEFT JOIN team_members tm ON tm.source_table='subcontractors'
--                              AND tm.source_id = sp.subcontractor_id
--     WHERE tm.id IS NULL;
--   -- Should return 0. Any row that returns means a payment exists for a
--   -- subcontractor that wasn't mirrored — would be orphaned by this migration.
--
--   SELECT COUNT(*) FROM job_workers jw
--     LEFT JOIN team_members tm ON tm.source_table='workers'
--                              AND tm.source_id = jw.worker_id
--     WHERE tm.id IS NULL;
--   -- Same check for job_workers.
--
--   SELECT COUNT(*) FROM worker_documents wd
--     LEFT JOIN team_members tm ON tm.source_table='workers'
--                              AND tm.source_id = wd.worker_id
--     WHERE tm.id IS NULL;
--   -- Same check for worker_documents.
--
-- Production state at time of writing: 1 subcontractor_payments row (Lewis),
-- 0 job_workers, 0 worker_documents. So this migration touches a single
-- payment row.

BEGIN;

-- 1. Remap subcontractor_payments.subcontractor_id from legacy id to tm.id
UPDATE subcontractor_payments sp
SET subcontractor_id = tm.id
FROM team_members tm
WHERE tm.source_table = 'subcontractors'
  AND tm.source_id = sp.subcontractor_id
  AND sp.subcontractor_id IS NOT NULL;

-- 2. Remap job_workers.worker_id from legacy id to tm.id (no-op if empty)
UPDATE job_workers jw
SET worker_id = tm.id
FROM team_members tm
WHERE tm.source_table = 'workers'
  AND tm.source_id = jw.worker_id
  AND jw.worker_id IS NOT NULL;

-- 3. Remap worker_documents.worker_id from legacy id to tm.id (no-op if empty)
UPDATE worker_documents wd
SET worker_id = tm.id
FROM team_members tm
WHERE tm.source_table = 'workers'
  AND tm.source_id = wd.worker_id
  AND wd.worker_id IS NOT NULL;

-- 4. Drop the three legacy FK constraints
ALTER TABLE subcontractor_payments
  DROP CONSTRAINT subcontractor_payments_subcontractor_id_fkey;

ALTER TABLE job_workers
  DROP CONSTRAINT job_workers_worker_id_fkey;

ALTER TABLE worker_documents
  DROP CONSTRAINT worker_documents_worker_id_fkey;

-- 5. Add three new FK constraints pointing at team_members.id.
--
-- ON DELETE behaviour: We use ON DELETE NO ACTION (the default) for these,
-- matching the original constraints. Code-side soft-deletes (active=false +
-- archived_at) are the actual delete pattern — hard deletes from
-- team_members would orphan payment/job-assignment/document records, which
-- is what the soft-delete pattern exists to prevent. The DB constraint
-- failing on hard delete is a deliberate safety net.
ALTER TABLE subcontractor_payments
  ADD CONSTRAINT subcontractor_payments_subcontractor_id_fkey
  FOREIGN KEY (subcontractor_id) REFERENCES team_members(id);

ALTER TABLE job_workers
  ADD CONSTRAINT job_workers_worker_id_fkey
  FOREIGN KEY (worker_id) REFERENCES team_members(id);

ALTER TABLE worker_documents
  ADD CONSTRAINT worker_documents_worker_id_fkey
  FOREIGN KEY (worker_id) REFERENCES team_members(id);

-- 6. Mark legacy tables as deprecated. Cosmetic but useful for anyone
--    poking around in psql or Supabase Studio.
COMMENT ON TABLE workers IS
  'DEPRECATED 2026-04-25. Replaced by team_members. No new writes — '
  'kept until Session 4 of the unification migration drops it. '
  'See docs/migrations/workers-subs-unification.md.';

COMMENT ON TABLE subcontractors IS
  'DEPRECATED 2026-04-25. Replaced by team_members. No new writes — '
  'kept until Session 4 of the unification migration drops it. '
  'See docs/migrations/workers-subs-unification.md.';

COMMIT;

-- Post-migration sanity check (run after commit):
--   SELECT COUNT(*) FROM subcontractor_payments sp
--     JOIN team_members tm ON tm.id = sp.subcontractor_id;
--   -- Should equal total payment row count. If less, FK isn't matching.
