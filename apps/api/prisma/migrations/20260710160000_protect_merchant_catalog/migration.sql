-- Protection catalogue commerçant : aucune suppression silencieuse.
-- Les DELETE sur MerchantShop / MerchantProduct exigent dans la même transaction :
--   SELECT set_config('fermier.allow_merchant_catalog_delete', '1', true);
-- TRUNCATE est toujours refusé.

CREATE OR REPLACE FUNCTION fermier_guard_merchant_catalog_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed text;
BEGIN
  allowed := current_setting('fermier.allow_merchant_catalog_delete', true);
  IF allowed IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION
      'Suppression de % bloquée (catalogue commerçant protégé). Autorisation explicite requise via set_config(''fermier.allow_merchant_catalog_delete'', ''1'', true) dans la transaction.',
      TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION fermier_guard_merchant_catalog_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'TRUNCATE de % interdit (catalogue commerçant protégé).',
    TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_merchant_shop_delete ON "MerchantShop";
CREATE TRIGGER trg_guard_merchant_shop_delete
  BEFORE DELETE ON "MerchantShop"
  FOR EACH ROW
  EXECUTE FUNCTION fermier_guard_merchant_catalog_delete();

DROP TRIGGER IF EXISTS trg_guard_merchant_product_delete ON "MerchantProduct";
CREATE TRIGGER trg_guard_merchant_product_delete
  BEFORE DELETE ON "MerchantProduct"
  FOR EACH ROW
  EXECUTE FUNCTION fermier_guard_merchant_catalog_delete();

DROP TRIGGER IF EXISTS trg_guard_merchant_shop_truncate ON "MerchantShop";
CREATE TRIGGER trg_guard_merchant_shop_truncate
  BEFORE TRUNCATE ON "MerchantShop"
  FOR EACH STATEMENT
  EXECUTE FUNCTION fermier_guard_merchant_catalog_truncate();

DROP TRIGGER IF EXISTS trg_guard_merchant_product_truncate ON "MerchantProduct";
CREATE TRIGGER trg_guard_merchant_product_truncate
  BEFORE TRUNCATE ON "MerchantProduct"
  FOR EACH STATEMENT
  EXECUTE FUNCTION fermier_guard_merchant_catalog_truncate();
