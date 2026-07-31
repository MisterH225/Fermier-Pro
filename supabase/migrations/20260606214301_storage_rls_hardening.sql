-- Phase 0 sécurité : durcissement RLS Storage (C-09, C-10)
-- finance-proofs : privé, accès membres ferme uniquement
-- animal-photos / listings : écriture restreinte aux membres ferme ; lecture publique conservée (marketplace)
-- vet-credentials : privé, propriétaire uniquement

CREATE OR REPLACE FUNCTION public.storage_farm_id_from_path(object_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN (storage.foldername(object_name))[1] = 'farms'
    THEN (storage.foldername(object_name))[2]
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_farm_storage_access(farm_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT farm_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM "User" u
        JOIN "Farm" f ON f."ownerId" = u.id
        WHERE f.id = farm_id
          AND u."supabaseUserId" = auth.uid()::text
      )
      OR EXISTS (
        SELECT 1
        FROM "User" u
        JOIN "FarmMembership" fm ON fm."userId" = u.id
        WHERE fm."farmId" = farm_id
          AND u."supabaseUserId" = auth.uid()::text
          AND fm.archived = false
      )
    );
$$;

-- ── finance-proofs (privé) ───────────────────────────────────────────────────

UPDATE storage.buckets
SET public = false
WHERE id = 'finance-proofs';

DROP POLICY IF EXISTS "finance_proofs_select_public" ON storage.objects;
DROP POLICY IF EXISTS "finance_proofs_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "finance_proofs_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "finance_proofs_delete_auth" ON storage.objects;

CREATE POLICY "finance_proofs_select_farm_member"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'finance-proofs'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "finance_proofs_insert_farm_member"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'finance-proofs'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "finance_proofs_update_farm_member"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'finance-proofs'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
)
WITH CHECK (
  bucket_id = 'finance-proofs'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "finance_proofs_delete_farm_member"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'finance-proofs'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

-- ── animal-photos (lecture publique, écriture membres ferme) ─────────────────

DROP POLICY IF EXISTS "animal_photos_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_delete_auth" ON storage.objects;

CREATE POLICY "animal_photos_insert_farm_member"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'animal-photos'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "animal_photos_update_farm_member"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'animal-photos'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
)
WITH CHECK (
  bucket_id = 'animal-photos'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "animal_photos_delete_farm_member"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'animal-photos'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

-- ── listings (lecture publique, écriture membres ferme) ──────────────────────

DROP POLICY IF EXISTS "listings_photos_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "listings_photos_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "listings_photos_delete_auth" ON storage.objects;

CREATE POLICY "listings_photos_insert_farm_member"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listings'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "listings_photos_update_farm_member"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'listings'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
)
WITH CHECK (
  bucket_id = 'listings'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

CREATE POLICY "listings_photos_delete_farm_member"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listings'
  AND public.auth_user_has_farm_storage_access(public.storage_farm_id_from_path(name))
);

-- ── vet-credentials (privé, propriétaire) ────────────────────────────────────

UPDATE storage.buckets
SET public = false
WHERE id = 'vet-credentials';

DROP POLICY IF EXISTS "vet_credentials_select_public" ON storage.objects;

CREATE POLICY "vet_credentials_select_owner"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vet-credentials'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
