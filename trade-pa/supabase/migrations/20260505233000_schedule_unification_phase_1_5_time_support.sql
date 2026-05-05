-- ════════════════════════════════════════════════════════════════════════════
-- Schedule Phase 1.5 — add precise time to job_cards.
-- start_date is date-only so all scheduled jobs were rendering at midnight UTC
-- (1am BST). Adding start_at/end_at (timestamptz) for true time scheduling.
-- ════════════════════════════════════════════════════════════════════════════

-- Schema additions
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS start_at timestamptz;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS end_at timestamptz;

-- Backfill existing job_cards with sensible 09:00–17:00 UK times
UPDATE job_cards 
SET start_at = (start_date::text || ' 09:00:00 Europe/London')::timestamptz
WHERE start_at IS NULL AND start_date IS NOT NULL;

UPDATE job_cards 
SET end_at = (end_date::text || ' 17:00:00 Europe/London')::timestamptz
WHERE end_at IS NULL AND end_date IS NOT NULL;

-- Update sync_job_card_to_jobs to use start_at when available
CREATE OR REPLACE FUNCTION sync_job_card_to_jobs()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_date_obj timestamptz;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.deleted_at IS NOT NULL THEN
      UPDATE jobs SET deleted_at = NEW.deleted_at
      WHERE source_type = 'job_card' AND source_ref = NEW.id::text AND deleted_at IS NULL;
      RETURN NEW;
    END IF;
    
    IF NEW.start_at IS NULL AND NEW.start_date IS NULL THEN
      UPDATE jobs SET deleted_at = NOW()
      WHERE source_type = 'job_card' AND source_ref = NEW.id::text AND deleted_at IS NULL;
      RETURN NEW;
    END IF;
    
    -- Prefer precise start_at; fall back to start_date + 09:00 London time
    v_date_obj := COALESCE(
      NEW.start_at,
      (NEW.start_date::text || ' 09:00:00 Europe/London')::timestamptz
    );
    
    INSERT INTO jobs (
      id, user_id, company_id, customer, address, type,
      date, date_obj, status, value, notes,
      source_type, source_ref, created_at, deleted_at
    ) VALUES (
      NEW.id::text, NEW.user_id, NEW.company_id,
      COALESCE(NEW.customer, ''),
      COALESCE(NEW.address, ''),
      COALESCE(NEW.type, 'electrical'),
      v_date_obj::date::text,
      v_date_obj,
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
    DELETE FROM jobs WHERE source_type = 'job_card' AND source_ref = OLD.id::text;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_job_card_to_jobs() TO authenticated, service_role;


-- Set realistic appointment times for Kieran's demo jobs
DO $kt$
DECLARE
  v_user uuid := '0fc769f9-2257-4eb9-8749-8c66766df8b1';
BEGIN
  UPDATE job_cards 
  SET start_at = '2026-05-05 14:00:00 Europe/London'::timestamptz,
      end_at   = '2026-05-05 16:00:00 Europe/London'::timestamptz
  WHERE user_id = v_user AND customer = 'Helen Pritchard' AND start_date = '2026-05-05';

  UPDATE job_cards 
  SET start_at = '2026-05-06 09:00:00 Europe/London'::timestamptz,
      end_at   = '2026-05-06 13:00:00 Europe/London'::timestamptz
  WHERE user_id = v_user AND customer = 'Robert Atkinson' AND start_date = '2026-05-06';

  UPDATE job_cards 
  SET start_at = '2026-05-07 13:00:00 Europe/London'::timestamptz,
      end_at   = '2026-05-07 16:00:00 Europe/London'::timestamptz
  WHERE user_id = v_user AND customer = 'Anita Wells' AND start_date = '2026-05-07';

  UPDATE job_cards 
  SET start_at = '2026-05-08 08:00:00 Europe/London'::timestamptz,
      end_at   = '2026-05-08 16:00:00 Europe/London'::timestamptz
  WHERE user_id = v_user AND customer = 'Tom Weaver' AND start_date = '2026-05-08';

  UPDATE job_cards 
  SET start_at = '2026-05-11 16:30:00 Europe/London'::timestamptz,
      end_at   = '2026-05-11 17:30:00 Europe/London'::timestamptz
  WHERE user_id = v_user AND customer = 'Steve Robertson' AND start_date = '2026-05-11';
END $kt$;
