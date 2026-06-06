-- Commission marketplace configurable depuis le dashboard admin
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "marketplaceCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05;

UPDATE "PlatformSettings"
SET "marketplaceCommissionRate" = 0.05
WHERE "marketplaceCommissionRate" IS NULL;
