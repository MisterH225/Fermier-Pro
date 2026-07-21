-- PR #110 : frais plateforme acheteur (buyerPaysCommission)
DO $$ BEGIN
  ALTER TABLE "MarketplaceTransaction"
  ADD COLUMN IF NOT EXISTS "buyerPaysCommission" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- PR #111 : frais plateforme vendeur (sellerCommissionRate / sellerCommissionAmount)
DO $$ BEGIN
  ALTER TABLE "MarketplaceTransaction"
  ADD COLUMN IF NOT EXISTS "sellerCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sellerCommissionAmount" DECIMAL(14,2);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- PR #111 : taux commission vendeur marketplace + taux vétérinaire dans PlatformSettings
DO $$ BEGIN
  ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "sellerMarketplaceCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS "vetCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- Initialiser les valeurs par défaut si la ligne existe déjà
UPDATE "PlatformSettings"
SET
  "sellerMarketplaceCommissionRate" = 0.05,
  "vetCommissionRate" = 0.05
WHERE id = 'default'
  AND ("sellerMarketplaceCommissionRate" IS NULL OR "vetCommissionRate" IS NULL);
