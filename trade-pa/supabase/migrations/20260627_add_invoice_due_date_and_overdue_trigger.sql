-- Applied via Supabase MCP on 2026-06-27.
-- Payment chasing foundation: give invoices a real typed due_date so they can
-- auto-flip to overdue. The existing `due` column is free text ("Due in 14 days",
-- ISO dates, "Valid for 30 days" on quotes) and cannot be compared to a date.
--
-- Strategy: parse the due text into due_date via a trigger so every insert path
-- (manual modal, quote->invoice convert, Eve create_invoice, create_invoice_from_job)
-- is covered with zero client changes. Quotes are skipped (no payment due date).

-- 1. Typed due date column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date date;

-- 2. Total parser: never raises, returns NULL when it cannot determine a date
CREATE OR REPLACE FUNCTION public.tradepa_parse_invoice_due_date(p_due text, p_created timestamptz)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_created date;
  v_days int;
BEGIN
  IF p_due IS NULL OR p_created IS NULL THEN
    RETURN NULL;
  END IF;
  v_created := p_created::date;

  IF p_due ~ '^\d{4}-\d{2}-\d{2}$' THEN
    BEGIN
      RETURN to_date(p_due, 'YYYY-MM-DD');
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  IF p_due ~* '(\d+)\s*day' THEN
    v_days := (regexp_match(p_due, '(\d+)\s*day'))[1]::int;
    RETURN (v_created + (v_days || ' days')::interval)::date;
  END IF;

  IF p_due ~* 'receipt' THEN
    RETURN v_created;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Trigger: populate due_date for invoices (not quotes)
CREATE OR REPLACE FUNCTION public.tradepa_set_invoice_due_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(new.is_quote, false) = false THEN
    IF new.due_date IS NULL
       OR (tg_op = 'UPDATE'
           AND new.due IS DISTINCT FROM old.due
           AND coalesce(new.status, '') IN ('sent','draft','overdue','due','pending')) THEN
      new.due_date := public.tradepa_parse_invoice_due_date(new.due, new.created_at);
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_due_date ON public.invoices;
CREATE TRIGGER trg_set_invoice_due_date
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.tradepa_set_invoice_due_date();

-- 4. Backfill existing live invoices (paid history left untouched)
UPDATE public.invoices
SET due_date = public.tradepa_parse_invoice_due_date(due, created_at)
WHERE is_quote IS NOT TRUE
  AND due_date IS NULL
  AND status <> 'paid'
  AND deleted_at IS NULL;
