-- Photos de sujets (cheptel)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'animal-photos',
  'animal-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "animal_photos_select_public" ON storage.objects;
CREATE POLICY "animal_photos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'animal-photos');

DROP POLICY IF EXISTS "animal_photos_insert_auth" ON storage.objects;
CREATE POLICY "animal_photos_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'animal-photos');

DROP POLICY IF EXISTS "animal_photos_update_auth" ON storage.objects;
CREATE POLICY "animal_photos_update_auth"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'animal-photos');

DROP POLICY IF EXISTS "animal_photos_delete_auth" ON storage.objects;
CREATE POLICY "animal_photos_delete_auth"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'animal-photos');
