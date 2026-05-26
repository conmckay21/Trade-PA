-- Log of material orders and price requests sent to suppliers.
-- Populated by /api/suppliers/send-material-order on successful send.
-- Used for "what did I last order from X" lookups, AI context, and
-- reordering by reusing previous item lists.

CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id bigint REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  supplier_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('order','price_request')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  job_ref text,
  subject text NOT NULL,
  body_html text,
  sent_via text CHECK (sent_via IN ('gmail','outlook')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_cascade_id uuid
);

CREATE INDEX IF NOT EXISTS supplier_orders_user_id_idx
  ON public.supplier_orders(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS supplier_orders_supplier_id_idx
  ON public.supplier_orders(supplier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS supplier_orders_sent_at_idx
  ON public.supplier_orders(user_id, sent_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own supplier orders"
  ON public.supplier_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own supplier orders"
  ON public.supplier_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own supplier orders"
  ON public.supplier_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own supplier orders"
  ON public.supplier_orders FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.supplier_orders IS
  'Log of material orders and price requests sent to suppliers. Populated on successful send via /api/suppliers/send-material-order.';
