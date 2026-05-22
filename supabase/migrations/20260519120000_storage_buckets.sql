-- Buckets Storage pour l’app mobile (avatars profil, preuves finance).
-- Supabase Dashboard → SQL Editor → New query :
--   Coller TOUT le SQL ci-dessous (pas le nom du fichier), puis Run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'finance-proofs',
    'finance-proofs',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── avatars ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── finance-proofs ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "finance_proofs_select_public" ON storage.objects;
CREATE POLICY "finance_proofs_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'finance-proofs');

DROP POLICY IF EXISTS "finance_proofs_insert_auth" ON storage.objects;
CREATE POLICY "finance_proofs_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'finance-proofs');

DROP POLICY IF EXISTS "finance_proofs_update_auth" ON storage.objects;
CREATE POLICY "finance_proofs_update_auth"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'finance-proofs');

DROP POLICY IF EXISTS "finance_proofs_delete_auth" ON storage.objects;
CREATE POLICY "finance_proofs_delete_auth"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'finance-proofs');
