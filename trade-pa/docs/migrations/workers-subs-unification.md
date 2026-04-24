# Workers / Subcontractors unification — migration plan

Status: **Session 2 DONE (2026-04-24)** — all 21 reads migrated to team_members via tmReadWorkers/tmReadSubs helpers. Dual-write remains; drop legacy tables in Session 3.
Last updated: 2026-04-24
Author: forensic audit session

## Problem

Trade PA currently has two separate database tables holding conceptually similar data:

- **`workers`** — tracks people on your team: PAYE staff and self-employed trades you assign to jobs. Columns include `name`, `type` (employed/subcontractor), `role`, `day_rate`, `hourly_rate`, `utr`, `cis_rate`, `ni_number`, `active`, `email`, `phone`.
- **`subcontractors`** — tracks external trades who run their own business and you pay via CIS. Columns include `name`, `company`, `utr`, `cis_rate`, `email`, `phone`, `active`.

The schemas overlap heavily (both have `name`, `utr`, `cis_rate`, `email`, `phone`, `active`). The distinctions are weak — a "self-employed worker" in the workers table and a "subcontractor" in the subcontractors table are the same kind of entity from an HMRC-CIS point of view.

### Downstream consequences

- **Divergent code paths.** `log_worker_time` and `log_subcontractor_payment` each have fallback logic to check the "other" table, because users don't consistently know which list a given person lives in.
- **Cross-table duplicates.** Nothing prevents a tradie from adding "John Smith" as a worker and separately as a subcontractor. Until tonight's surgical fix, both `add_worker` and `add_subcontractor` only checked their own table — so the same person could end up with two separate records, neither of which talks to the other.
- **Separate views.** `SubcontractorsTab` has a `mode` prop (`"workers"` vs `"subs"`) that effectively runs two UIs on one component. Still two lists for the user to flip between.
- **16 DB call-sites per table** to maintain in lockstep. Schema drift is inevitable over time.

The temporary fix shipped tonight (cross-table dedup warnings on add) reduces the chance of accidental duplicates but doesn't solve the underlying duplication of storage and logic.

## Proposed target schema

A single unified table: **`team_members`**.

```sql
CREATE TABLE team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  company_id   UUID REFERENCES companies(id),

  -- Identity
  name         TEXT NOT NULL,
  role         TEXT,                 -- "electrician", "labourer" etc.
  company_name TEXT,                 -- only populated for self-employed trading as a business

  -- Classification
  engagement   TEXT NOT NULL CHECK (engagement IN ('employed', 'self_employed')),
                                    -- Replaces workers.type. "self_employed" unifies
                                    -- both "subcontractor" entries and workers.type='subcontractor'.

  -- Pay
  day_rate     NUMERIC,
  hourly_rate  NUMERIC,

  -- Tax identifiers
  utr          TEXT,                 -- UTR if self-employed
  ni_number    TEXT,                 -- NI number if employed
  cis_rate     INTEGER,              -- 0 | 20 | 30, only meaningful if self-employed

  -- Contact
  email        TEXT,
  phone        TEXT,

  -- Lifecycle
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at  TIMESTAMPTZ,          -- mirrors the soft-delete pattern used on cis_statements

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ
);

CREATE INDEX idx_team_members_user_active ON team_members (user_id)
  WHERE active = TRUE AND archived_at IS NULL;
CREATE INDEX idx_team_members_engagement ON team_members (user_id, engagement)
  WHERE active = TRUE AND archived_at IS NULL;
```

Row-level security policies mirror the existing ones on `workers` and `subcontractors`.

## Migration steps

This is a multi-session piece of work. Rough order:

### Session 1 — schema + dual-write ✅ COMPLETE (2026-04-24)

1. ✅ Created the `team_members` table + RLS policy (`team_members_owner`: `auth.uid() = user_id`) + updated_at trigger.
2. ✅ Added `source_table` + `source_id` columns (not in original design) to track which legacy row each mirror row came from, with a partial unique index on `(user_id, source_table, source_id) WHERE source_table IS NOT NULL` so the shim upsert is idempotent.
3. ✅ Dual-write shim in `App.jsx` — three module-level helpers:
   - `mirrorToTeamMembers(sourceTable, row)` — full-row upsert for inserts/updates, best-effort (never blocks the primary write).
   - `setTeamMembersArchived(sourceTable, sourceId, userId, isArchived)` — targeted UPDATE for soft-delete/archive so we don't null-out other fields.
   - `unmirrorFromTeamMembers(sourceTable, sourceId, userId)` — delete matching row. Called on hard deletes.
4. ✅ Mirror calls added at 13 write sites across the AI tools (`add_worker`, `add_subcontractor`, `update_worker`, `delete_worker`, `delete_subcontractor`, worker/sub reactivation paths) and the UI (`saveSub`, `saveWorker`, `updateWorker`, `deleteWorker`).
5. ✅ Backfill: 1 existing sub row mirrored (0 workers existed). Production row count verified.

**Known short-term duplication** (intentional, fixed in Session 3):

The `saveWorker` UI path writes to BOTH `workers` AND `subcontractors` when `type === "subcontractor"` — an old pattern that mirrors into two separate `team_members` rows for the same human (one with `source_table='workers'`, one with `source_table='subcontractors'`). Session 3 (read-cutover) will add a name-level dedupe. For now: accept the duplication, don't try to read from `team_members` as source-of-truth yet.

Verified end-to-end on production: fake insert → mirror → idempotent re-upsert → clean delete. Database state returned to clean baseline after test.

### Session 2 — read migration ✅ COMPLETE (2026-04-24)

**Helpers added** (module-level, after mirror shim in App.jsx ~line 28489):
- `tmReadWorkers(db, userId, { activeOnly, nameLike, limit })` — drop-in replacement for `from("workers").select(...)`. Queries team_members with `source_table='workers'` filter. Translates result rows to legacy workers shape (`type` from `engagement`, all workers-only columns). Returns `{ data, error }` like supabase-js.
- `tmReadSubs(db, userId, { activeOnly, nameLike, limit })` — same pattern with `source_table='subcontractors'`. Translates to legacy subcontractors shape (`company` from `company_name`).

Both helpers preserve legacy table-scope semantics exactly — subs reads get subcontractors-mirrored rows, workers reads get workers-mirrored rows. This means the `saveWorker type='subcontractor'` double-write still produces two rows for the same human, which Session 3 dedupes.

`id` in returned rows comes from `source_id` where populated (all current rows have it — backfill + mirror both set it), so downstream `.eq("id", row.id)` against legacy tables still works. When Session 3 drops legacy tables, this behaviour naturally falls back to `tm.id`.

**All 21 read call-sites migrated** across 3 groups:
- **UI load (2)**: Subcontractors tab initial load (`db.from("subcontractors").select("*")` + `db.from("workers").select("*")` at lines ~25703/25705).
- **Subcontractor handlers (10)**: add_subcontractor existence check, log_subcontractor_payment sub lookup + workers fallback, list_subcontractors, list_unpaid (by-id lookup via client-side filter), generate_subcontractor_statement, add_worker cross-table check, delete_subcontractor, update_subcontractor_payment, delete_subcontractor_payment, saveWorker's auto-sub-insert existingSub check.
- **Worker handlers (9)**: add_subcontractor cross-table check, add_worker existence check, list_workers, assign_worker_to_job, log_worker_time (worker lookup + sub fallback), add_worker_document, update_worker, delete_worker.

**Production verification**: team_members contains 1 subcontractor (Lewis Skelton, active=true, source_table='subcontractors', cis_rate=20), 0 workers — exactly matching the legacy state. Dual-write from Session 1 working as designed. No data loss expected on cutover.

**Known short-term duplication** (accepted, Session 3 dedupes): none in current prod — saveWorker type='subcontractor' hasn't been called against the new mirror shim yet. First call would create one row for the user from `workers` table AND one row from the auto-`subcontractors` insert, both mirrored to team_members as separate rows with different source_table values.

**Handler files:**
- `tmReadWorkers` / `tmReadSubs`: `src/App.jsx` ~28489-28564
- Example call site: `tmReadSubs(db, user?.id, { nameLike: input.name, limit: 1 })`

### Session 3 — write-to-team_members-only cutover

1. Switch the dual-write layer to write only to `team_members`, no longer to the old tables.
2. Observe for a sync period (1-2 weeks) to catch any missed read paths that broke.
3. Add a migration warning / database comment to mark `workers` and `subcontractors` as deprecated.

### Session 4 — drop old tables

1. Back up old tables.
2. Drop `workers` and `subcontractors`.
3. Clean up shim layer.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| FK dependencies break (e.g. `job_workers.worker_id` references `workers.id`) | Keep the old tables populated via shim during the whole migration window. `job_workers.worker_id` continues to work because `workers` rows aren't dropped until session 4. |
| Cross-table uniqueness gaps | Add a partial unique index on `(user_id, lower(name))` in `team_members` once dual-write is stable. |
| Read/write drift during cutover | The dual-write layer keeps them in sync. Periodic sanity-check SQL job counts rows match. |
| `cis_statements.contractor_name` is a free-text string, not a FK | Leave as-is for now. A future v2 could add `contractor_id UUID REFERENCES team_members(id)` as a nullable column and migrate over time. |

## Non-goals for this migration

- **No change to `job_workers` table.** It stays pointed at `worker_id UUID`. Post-migration, `worker_id` just references the equivalent `team_members.id` (which is the same UUID because of dual-write backfill).
- **No change to `subcontractor_payments` table.** Same reasoning — the `subcontractor_id` column keeps working.
- **No change to `cis_statements`.** It uses `contractor_name` (free text), not a FK. Untouched.
- **No change to `SubcontractorsTab.mode`.** The UI continues to present two filtered views, just reading from `team_members` with `engagement` filter instead of two tables.

## Out-of-scope — considered and deferred

- **Unifying `job_workers` and a future `job_subcontractors` table.** There is no `job_subcontractors` table today. `job_workers` serves both via the cross-table fallback logic.
- **Per-role rate history.** Some apps track rate changes over time; Trade PA currently doesn't, and this migration shouldn't introduce it.
- **Linking customers' own contacts into the same table.** Different concern — customer contacts are people you *sell to*, not people who work *for* you.

## Success criteria

After migration completes:

- One canonical table for all human workers in the tradie's orbit.
- `add_worker` and `add_subcontractor` AI tools both write to `team_members`; no cross-table dedup warning needed (single-table dedup is trivial).
- 32 DB read sites reduced to a smaller number of reads filtered by `engagement`.
- Zero behaviour regression in job-time-logging, CIS calculations, payment logging, or job assignment.
- Old `workers` and `subcontractors` tables dropped.

## Notes

- The partial soft-delete pattern used on `cis_statements` (`archived_at TIMESTAMPTZ NULL`) is adopted here intentionally. `active` BOOLEAN is kept alongside for backwards compatibility with existing code that filters on it, but `archived_at` becomes the source of truth going forward.
- The `engagement` discriminator has two values: `employed` and `self_employed`. The current `workers.type` field has `employed` and `subcontractor`; existing rows map cleanly (`subcontractor` → `self_employed`).
- `company_name` is optional in the new schema — populated only when a self-employed trade operates through a trading name ("Bob's Plumbing Ltd"). For people operating under their own name, it's null.
