-- =============================================================================
-- 20260511230400_add_draft_solution_to_support_ticket_triage.sql
-- =============================================================================
-- Adds a "draft_solution" field to the AI triage output.
--
-- Where bug_diagnosis explains the likely cause to the FOUNDER, draft_solution
-- tells the founder what to do about it. Adapts to ticket kind:
--   - bug         -> suggested fix (where to look in the codebase, verification)
--   - suggestion  -> implementation sketch (when recommendation=build)
--   - billing     -> ops steps (e.g. "check Stripe subscription, verify card")
--   - account     -> ops steps
--   - other       -> null
--
-- Optional column: legacy rows have null, new triage runs populate it where it
-- adds value. UI renders the subpanel only when non-null.
-- =============================================================================

alter table public.support_ticket_triage
  add column if not exists draft_solution text;
