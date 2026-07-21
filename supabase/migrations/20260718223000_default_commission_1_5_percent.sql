-- Taux de commission par défaut : 1,5 % (si non configuré par le super admin).
-- Les lignes encore à l'ancien défaut 5 % sont basculées vers 1,5 %.

DO $$ BEGIN
  ALTER TABLE "PlatformSettings"
  ALTER COLUMN "marketplaceCommissionRate" SET DEFAULT 0.015,
  ALTER COLUMN "sellerMarketplaceCommissionRate" SET DEFAULT 0.015,
  ALTER COLUMN "vetCommissionRate" SET DEFAULT 0.015;
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE "PlatformSettings"
SET
  "marketplaceCommissionRate" = 0.015
WHERE "marketplaceCommissionRate" = 0.05;
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE "PlatformSettings"
SET
  "sellerMarketplaceCommissionRate" = 0.015
WHERE "sellerMarketplaceCommissionRate" = 0.05;
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE "PlatformSettings"
SET
  "vetCommissionRate" = 0.015
WHERE "vetCommissionRate" = 0.05;
EXCEPTION WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;