-- =============================================================================
-- 20260511232100_update_admin_get_ticket_triage_return_draft_solution.sql
-- =============================================================================
-- The original admin_get_ticket_triage RPC (from 20260511221802) was created
-- before the draft_solution column was added (in 20260511230400). Its
-- RETURNS TABLE signature pins an explicit column list, so the new column
-- was getting silently dropped on the way back to the client.
--
-- Postgres doesn't allow changing the return type via CREATE OR REPLACE,
-- so we drop and recreate. Add draft_solution to both the signature and
-- the SELECT list, slotted in after bug_diagnosis to match the bug-then-fix
-- ordering used in the rest of the codebase.
-- =============================================================================

drop function if exists public.admin_get_ticket_triage(uuid);

create function public.admin_get_ticket_triage(p_ticket_id uuid)
returns table (
  ticket_id                    uuid,
  kind                         text,
  severity_suggested           text,
  category_suggested           text,
  summary_one_line             text,
  draft_reply                  text,
  bug_diagnosis                text,
  draft_solution               text,
  suggestion_feasibility_score integer,
  suggestion_strength_score    integer,
  suggestion_recommendation    text,
  related_ticket_ids           uuid[],
  model_used                   text,
  prompt_tokens                integer,
  completion_tokens            integer,
  generated_at                 timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select t.ticket_id, t.kind, t.severity_suggested, t.category_suggested,
         t.summary_one_line, t.draft_reply, t.bug_diagnosis, t.draft_solution,
         t.suggestion_feasibility_score, t.suggestion_strength_score,
         t.suggestion_recommendation, t.related_ticket_ids,
         t.model_used, t.prompt_tokens, t.completion_tokens, t.generated_at
  from public.support_ticket_triage t
  where t.ticket_id = p_ticket_id;
end;
$$;

revoke all on function public.admin_get_ticket_triage(uuid) from public;
grant execute on function public.admin_get_ticket_triage(uuid) to authenticated;
