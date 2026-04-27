-- Receipts → Supabase Storage migration (Phase 1: bucket + RLS + new column)
-- 2026-04-27 — forensic audit Finding 1.1
--
-- Today: receipt PDFs are stored as base64 text in materials.receipt_image.
-- One real receipt = ~400KB. At 100 users × 50/month = 2GB/month DB growth.
-- This destroys the Free tier in a week and bloats Pro tier rapidly.
--
-- Going forward: receipts live in Supabase Storage at receipts/{userId}/{filename}.
-- The materials table stores only the storage path (a short string, ~80 bytes).
--
-- Migration is two-phased:
--   Phase 1 (this migration): create bucket + add receipt_storage_path column
--   Phase 2 (later): backfill the 1 existing receipt, then drop receipt_image
--
-- The two phases are split so the app code can roll out, write to BOTH the
-- new path AND old column for a short overlap period, then we can backfill
-- and drop in safety.

-- Create the bucket. Private (no public reads) — access is via signed URLs
-- that the app generates on-demand. 10MB max file size — receipts are
-- typically <500KB, 10MB is generous headroom for high-res scans.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: users can only access their own folder under receipts/{userId}/
-- The path convention is enforced at upload time by the app — we store at
-- {auth.uid()}/some-filename.pdf so storage.foldername(name)[1] is the user
-- id, and the policy checks it equals auth.uid().

-- INSERT
CREATE POLICY "users can upload receipts to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT (used by signed URL generation + getPublicUrl in code)
CREATE POLICY "users can read their own receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE — for renames or metadata changes (rare but possible)
CREATE POLICY "users can update their own receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE — for purging old receipts on row-delete
CREATE POLICY "users can delete their own receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add the new column to materials. Old column receipt_image stays for now —
-- we'll drop it in Phase 2 after backfill.
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_materials_receipt_storage_path
  ON materials(receipt_storage_path)
  WHERE receipt_storage_path IS NOT NULL AND deleted_at IS NULL;
