-- =============================================================================
-- 20260511221802_create_support_ticket_triage.sql
-- AI triage table + RPCs for the support ticket system
-- =============================================================================
-- One row per ticket holding the AI-generated triage. Re-analysing the ticket
-- overwrites the row (PK on ticket_id with ON DELETE CASCADE).
--
-- Writes: server-side only, via the service_role from /api/lib/triage.js
-- Reads:  admin frontend via admin_get_ticket_triage (SECURITY DEFINER + admin_is_admin)
--
-- Also adds triage_get_suggestion_context(uuid) — a helper that returns the 30
-- most recent OTHER feature_request tickets, used by the triage worker to
-- give Claude cross-ticket pattern-match evidence for suggestion-strength.
-- =============================================================================

create table if not exists public.support_ticket_triage (
  ticket_id                     uuid primary key references public.support_tickets(id) on delete cascade,
  kind                          text not null
    check (kind in ('bug','suggestion','billing','account','other')),
  severity_suggested            text not null
    check (severity_suggested in ('low','normal','high','urgent')),
  category_suggested            text not null
    check (category_suggested in ('billing','bug','feature_request','account','other')),
  summary_one_line              text not null,
  draft_reply                   text not null,
  bug_diagnosis                 text,
  suggestion_feasibility_score  int  check (suggestion_feasibility_score between 1 and 10),
  suggestion_strength_score     int  check (suggestion_strength_score between 1 and 10),
  suggestion_recommendation     text check (suggestion_recommendation in ('build','defer','decline')),
  related_ticket_ids            uuid[] not null default '{}',
  model_used                    text not null,
  prompt_tokens                 int,
  completion_tokens             int,
  generated_at                  timestamptz not null default now()
);

comment on table public.support_ticket_triage is
  'AI-generated triage for support_tickets. One row per ticket (PK). Re-analysing the ticket overwrites this row.';

alter table public.support_ticket_triage enable row level security;

drop policy if exists "admins can select triage" on public.support_ticket_triage;
create policy "admins can select triage" on public.support_ticket_triage
  for select using (public.admin_is_admin());


create or replace function public.admin_get_ticket_triage(p_ticket_id uuid)
returns table (
  ticket_id                    uuid,
  kind                         text,
  severity_suggested           text,
  category_suggested           text,
  summary_one_line             text,
  draft_reply                  text,
  bug_diagnosis                text,
  suggestion_feasibility_score int,
  suggestion_strength_score    int,
  suggestion_recommendation    text,
  related_ticket_ids           uuid[],
  model_used                   text,
  prompt_tokens                int,
  completion_tokens            int,
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
         t.summary_one_line, t.draft_reply, t.bug_diagnosis,
         t.suggestion_feasibility_score, t.suggestion_strength_score,
         t.suggestion_recommendation, t.related_ticket_ids,
         t.model_used, t.prompt_tokens, t.completion_tokens, t.generated_at
  from public.support_ticket_triage t
  where t.ticket_id = p_ticket_id;
end;
$$;

revoke all on function public.admin_get_ticket_triage(uuid) from public;
grant execute on function public.admin_get_ticket_triage(uuid) to authenticated;


create or replace function public.triage_get_suggestion_context(p_exclude_ticket_id uuid)
returns table (
  id         uuid,
  subject    text,
  preview    text,
  status     text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.subject,
    (select substr(m.body, 1, 500) from public.support_messages m
      where m.ticket_id = t.id order by m.created_at asc limit 1) as preview,
    t.status,
    t.created_at
  from public.support_tickets t
  where t.category = 'feature_request'
    and t.id <> p_exclude_ticket_id
  order by t.created_at desc
  limit 30;
end;
$$;

revoke all on function public.triage_get_suggestion_context(uuid) from public;
grant execute on function public.triage_get_suggestion_context(uuid) to service_role;
