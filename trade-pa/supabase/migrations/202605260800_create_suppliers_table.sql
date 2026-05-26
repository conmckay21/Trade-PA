-- Suppliers as a first-class entity, mirroring customers table conventions
-- Applied: 2026-05-26 via Supabase MCP
-- Backfills supplier names from ai_context.suppliers JSONB array.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_cascade_id uuid
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_user_name_unique ON public.suppliers(user_id, name) WHERE deleted_at IS NULL AND name IS NOT NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own suppliers" ON public.suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own suppliers" ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own suppliers" ON public.suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own suppliers" ON public.suppliers FOR DELETE USING (auth.uid() = user_id);

INSERT INTO public.suppliers (user_id, name, created_at)
SELECT ac.user_id, TRIM(supplier_name) AS name, now()
FROM public.ai_context ac, jsonb_array_elements_text(ac.suppliers) AS supplier_name
WHERE ac.suppliers IS NOT NULL
  AND jsonb_typeof(ac.suppliers) = 'array'
  AND jsonb_array_length(ac.suppliers) > 0
  AND TRIM(supplier_name) != ''
  AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.user_id = ac.user_id AND LOWER(TRIM(s.name)) = LOWER(TRIM(supplier_name)) AND s.deleted_at IS NULL);
