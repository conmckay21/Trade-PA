-- Workers/Subcontractors unification — Session 4 (drop legacy tables)
-- 2026-04-25
--
-- Final session of the unification migration. Drops the deprecated `workers`
-- and `subcontractors` tables. Verified pre-migration:
--   - Zero FK references from any other table (Session 3 redirected them)
--   - Zero references in App.jsx (write paths refactored, read paths
--     migrated, FK-join syntax updated to team_members)
--   - Zero references in any Postgres function or view
--   - Zero customer traffic (1 row migrated cleanly, no trials yet)
--
-- After this migration, team_members.source_table and source_id columns
-- become archaeology only — kept populated for any post-migration forensic
-- queries, but no live code reads them. A future session may migrate the
-- tmReadWorkers/tmReadSubs filter from source_table to engagement, but
-- that's a UX-affecting decision deferred for now.

DROP TABLE workers;
DROP TABLE subcontractors;
