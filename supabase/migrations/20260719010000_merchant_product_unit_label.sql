-- Unité de vente libre sur les produits commerçant.
DO $$ BEGIN
  ALTER TABLE "MerchantProduct"
  ADD COLUMN IF NOT EXISTS "unitLabel" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;