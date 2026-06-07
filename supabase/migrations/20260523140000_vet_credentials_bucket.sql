-- Bucket pour diplômes vétérinaires (upload mobile onboarding)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vet-credentials',
  'vet-credentials',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "vet_credentials_select_public" ON storage.objects;
CREATE POLICY "vet_credentials_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vet-credentials');

DROP POLICY IF EXISTS "vet_credentials_insert_auth" ON storage.objects;
CREATE POLICY "vet_credentials_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vet-credentials'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "vet_credentials_update_auth" ON storage.objects;
CREATE POLICY "vet_credentials_update_auth"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vet-credentials'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "vet_credentials_delete_auth" ON storage.objects;
CREATE POLICY "vet_credentials_delete_auth"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vet-credentials'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
