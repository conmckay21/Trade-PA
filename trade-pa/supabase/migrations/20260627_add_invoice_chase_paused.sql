ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS chase_paused boolean NOT NULL DEFAULT false;
