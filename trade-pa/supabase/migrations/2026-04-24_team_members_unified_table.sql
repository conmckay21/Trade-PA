-- Migration: team_members_unified_table
-- Date: 2026-04-24
-- Status: APPLIED to production (session 1 of workers+subcontractors unification)
-- See docs/migrations/workers-subs-unification.md for full design rationale.
--
-- Session 1 scope:
--   - Create the table with RLS
--   - Backfill from existing workers + subcontractors
--   - Dual-write shim in App.jsx writes here alongside the legacy tables
--   - Zero user-visible change; reads still come from workers + subcontractors

CREATE TABLE IF NOT EXISTS public.team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name         text NOT NULL,
  role         text,
  company_name text,

  -- Classification
  engagement   text NOT NULL CHECK (engagement IN ('employed', 'self_employed')),

  -- Pay
  day_rate     numeric,
  hourly_rate  numeric,

  -- Tax identifiers
  utr          text,
  ni_number    text,
  cis_rate     integer,

  -- Contact
  email        text,
  phone        text,
  address      text,

  -- Lifecycle
  active       boolean NOT NULL DEFAULT true,
  archived_at  timestamptz,
  start_date   date,
  notes        text,

  -- Shim-era tracking — drop in Session 4
  source_table text CHECK (source_table IS NULL OR source_table IN ('workers', 'subcontractors')),
  source_id    uuid,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_members_source
  ON public.team_members (user_id, source_table, source_id)
  WHERE source_table IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_engagement_active
  ON public.team_members (user_id, engagement)
  WHERE active = true AND archived_at IS NULL;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_members_owner ON public.team_members;
CREATE POLICY team_members_owner ON public.team_members
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public._touch_team_members_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public._touch_team_members_updated_at();

-- Backfill from existing tables (run AFTER table creation)
INSERT INTO public.team_members (
  user_id, name, company_name, engagement,
  utr, cis_rate, email, phone, active,
  source_table, source_id, created_at
)
SELECT
  user_id, name, company, 'self_employed',
  utr, cis_rate, email, phone, COALESCE(active, true),
  'subcontractors', id, COALESCE(created_at, now())
FROM public.subcontractors
ON CONFLICT (user_id, source_table, source_id) WHERE source_table IS NOT NULL DO NOTHING;

INSERT INTO public.team_members (
  user_id, name, role, engagement,
  day_rate, hourly_rate, utr, cis_rate, ni_number,
  email, phone, address, active, start_date, notes,
  source_table, source_id, created_at
)
SELECT
  user_id, name, role,
  CASE WHEN type = 'employed' THEN 'employed' ELSE 'self_employed' END,
  day_rate, hourly_rate, utr, cis_rate, ni_number,
  email, phone, address, COALESCE(active, true), start_date, notes,
  'workers', id, COALESCE(created_at, now())
FROM public.workers
ON CONFLICT (user_id, source_table, source_id) WHERE source_table IS NOT NULL DO NOTHING;
