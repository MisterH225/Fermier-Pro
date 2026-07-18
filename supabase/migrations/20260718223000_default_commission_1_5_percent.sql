-- Taux de commission par défaut : 1,5 % (si non configuré par le super admin).
-- Les lignes encore à l'ancien défaut 5 % sont basculées vers 1,5 %.

ALTER TABLE "PlatformSettings"
  ALTER COLUMN "marketplaceCommissionRate" SET DEFAULT 0.015,
  ALTER COLUMN "sellerMarketplaceCommissionRate" SET DEFAULT 0.015,
  ALTER COLUMN "vetCommissionRate" SET DEFAULT 0.015;

UPDATE "PlatformSettings"
SET
  "marketplaceCommissionRate" = 0.015
WHERE "marketplaceCommissionRate" = 0.05;

UPDATE "PlatformSettings"
SET
  "sellerMarketplaceCommissionRate" = 0.015
WHERE "sellerMarketplaceCommissionRate" = 0.05;

UPDATE "PlatformSettings"
SET
  "vetCommissionRate" = 0.015
WHERE "vetCommissionRate" = 0.05;
