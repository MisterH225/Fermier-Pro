-- Photos produits commerçant (bucket public, écriture propriétaire boutique)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-products',
  'merchant-products',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.storage_merchant_shop_id_from_path(object_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN (storage.foldername(object_name))[1] = 'shops'
    THEN (storage.foldername(object_name))[2]
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_merchant_shop_storage_access(shop_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "User" u
      JOIN "MerchantProfile" mp ON mp."userId" = u.id
      JOIN "MerchantShop" ms ON ms."merchantProfileId" = mp.id
      WHERE ms.id = shop_id
        AND u."supabaseUserId" = auth.uid()::text
    );
$$;

DROP POLICY IF EXISTS "merchant_products_select_public" ON storage.objects;
CREATE POLICY "merchant_products_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'merchant-products');

DROP POLICY IF EXISTS "merchant_products_insert_owner" ON storage.objects;
CREATE POLICY "merchant_products_insert_owner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'merchant-products'
  AND public.auth_user_has_merchant_shop_storage_access(
    public.storage_merchant_shop_id_from_path(name)
  )
);

DROP POLICY IF EXISTS "merchant_products_update_owner" ON storage.objects;
CREATE POLICY "merchant_products_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'merchant-products'
  AND public.auth_user_has_merchant_shop_storage_access(
    public.storage_merchant_shop_id_from_path(name)
  )
)
WITH CHECK (
  bucket_id = 'merchant-products'
  AND public.auth_user_has_merchant_shop_storage_access(
    public.storage_merchant_shop_id_from_path(name)
  )
);

DROP POLICY IF EXISTS "merchant_products_delete_owner" ON storage.objects;
CREATE POLICY "merchant_products_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'merchant-products'
  AND public.auth_user_has_merchant_shop_storage_access(
    public.storage_merchant_shop_id_from_path(name)
  )
);
