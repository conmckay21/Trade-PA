-- ════════════════════════════════════════════════════════════════════════════
-- Schedule unification — jobs table becomes the single source of truth for the
-- calendar/diary. All schedule entries carry source_type + source_ref pointing
-- back to the originating record.
--
-- Sources that can feed the schedule:
--   • job_card → automatically synced on INSERT/UPDATE/DELETE via trigger
--   • enquiry → synced when scheduled_visit_at is set, removed when cleared
--   • manual → user-created directly in the calendar UI (no source link)
--
-- A manual entry can be promoted to a job_card later by updating its
-- source_type/source_ref via the app (no DB-level magic for that path).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Phase 1: Schema additions ──────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_ref text;

-- Constrain source_type to known values (NULL allowed during backfill)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_source_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('enquiry', 'job_card', 'manual'));

-- Index for fast lookup by source
CREATE INDEX IF NOT EXISTS idx_jobs_source 
  ON jobs(source_type, source_ref) 
  WHERE deleted_at IS NULL;

-- New field on enquiries for the scheduled visit timestamp
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS scheduled_visit_at timestamptz;


-- ─── Phase 2a: Trigger — job_cards → jobs ───────────────────────────────────
CREATE OR REPLACE FUNCTION sync_job_card_to_jobs()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Soft-delete: propagate to schedule entry
    IF NEW.deleted_at IS NOT NULL THEN
      UPDATE jobs SET deleted_at = NEW.deleted_at
      WHERE source_type = 'job_card' 
        AND source_ref = NEW.id::text 
        AND deleted_at IS NULL;
      RETURN NEW;
    END IF;
    
    -- No start_date means no schedule entry needed
    IF NEW.start_date IS NULL THEN
      UPDATE jobs SET deleted_at = NOW()
      WHERE source_type = 'job_card' 
        AND source_ref = NEW.id::text 
        AND deleted_at IS NULL;
      RETURN NEW;
    END IF;
    
    -- Upsert the schedule entry. ID is deterministic (job_card.id) so re-runs
    -- are safe and ON CONFLICT (id) handles the update path.
    INSERT INTO jobs (
      id, user_id, company_id, customer, address, type,
      date, date_obj, status, value, notes,
      source_type, source_ref, created_at, deleted_at
    ) VALUES (
      NEW.id::text, NEW.user_id, NEW.company_id,
      COALESCE(NEW.customer, ''), 
      COALESCE(NEW.address, ''),
      COALESCE(NEW.type, 'electrical'),
      NEW.start_date::text, 
      NEW.start_date::timestamptz,
      COALESCE(NEW.status, 'scheduled'),
      COALESCE(NEW.value, 0),
      COALESCE(NEW.notes, NEW.scope_of_work, ''),
      'job_card', 
      NEW.id::text,
      NEW.created_at, 
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      customer = EXCLUDED.customer,
      address = EXCLUDED.address,
      type = EXCLUDED.type,
      date = EXCLUDED.date,
      date_obj = EXCLUDED.date_obj,
      status = EXCLUDED.status,
      value = EXCLUDED.value,
      notes = EXCLUDED.notes,
      source_type = EXCLUDED.source_type,
      source_ref = EXCLUDED.source_ref,
      deleted_at = NULL;
    
    RETURN NEW;
  
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM jobs
    WHERE source_type = 'job_card' AND source_ref = OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_job_card_to_jobs() TO authenticated, service_role;

DROP TRIGGER IF EXISTS sync_job_card_to_jobs_trigger ON job_cards;
CREATE TRIGGER sync_job_card_to_jobs_trigger
AFTER INSERT OR UPDATE OR DELETE ON job_cards
FOR EACH ROW EXECUTE FUNCTION sync_job_card_to_jobs();


-- ─── Phase 2b: Trigger — enquiries → jobs ───────────────────────────────────
CREATE OR REPLACE FUNCTION sync_enquiry_to_jobs()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.deleted_at IS NOT NULL THEN
      UPDATE jobs SET deleted_at = NEW.deleted_at
      WHERE source_type = 'enquiry' 
        AND source_ref = NEW.id::text 
        AND deleted_at IS NULL;
      RETURN NEW;
    END IF;
    
    -- No scheduled visit means no schedule entry
    IF NEW.scheduled_visit_at IS NULL THEN
      UPDATE jobs SET deleted_at = NOW()
      WHERE source_type = 'enquiry' 
        AND source_ref = NEW.id::text 
        AND deleted_at IS NULL;
      RETURN NEW;
    END IF;
    
    -- Upsert. Use 'enq-<id>' prefix so enquiry-sourced rows can't collide
    -- with job_card-sourced rows (whose id is the raw job_card UUID).
    INSERT INTO jobs (
      id, user_id, company_id, customer, address, type,
      date, date_obj, status, value, notes,
      source_type, source_ref, created_at, deleted_at
    ) VALUES (
      'enq-' || NEW.id::text,
      NEW.user_id, NEW.company_id,
      COALESCE(NEW.name, ''),
      COALESCE(NEW.address, ''),
      'quote_visit',
      NEW.scheduled_visit_at::text,
      NEW.scheduled_visit_at,
      'scheduled',
      0,
      COALESCE(NEW.msg, ''),
      'enquiry', 
      NEW.id::text,
      NEW.created_at, 
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      customer = EXCLUDED.customer,
      address = EXCLUDED.address,
      date = EXCLUDED.date,
      date_obj = EXCLUDED.date_obj,
      notes = EXCLUDED.notes,
      source_type = EXCLUDED.source_type,
      source_ref = EXCLUDED.source_ref,
      deleted_at = NULL;
    
    RETURN NEW;
  
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM jobs
    WHERE source_type = 'enquiry' AND source_ref = OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_enquiry_to_jobs() TO authenticated, service_role;

DROP TRIGGER IF EXISTS sync_enquiry_to_jobs_trigger ON enquiries;
CREATE TRIGGER sync_enquiry_to_jobs_trigger
AFTER INSERT OR UPDATE OR DELETE ON enquiries
FOR EACH ROW EXECUTE FUNCTION sync_enquiry_to_jobs();


-- ─── Phase 3: Backfill existing jobs rows with source info ──────────────────
UPDATE jobs SET
  source_type = 'job_card',
  source_ref = jobs.id
WHERE source_type IS NULL
  AND EXISTS (
    SELECT 1 FROM job_cards jc 
    WHERE jc.id::text = jobs.id 
      AND jc.deleted_at IS NULL
  );

UPDATE jobs SET source_type = 'manual'
WHERE source_type IS NULL;
