-- Seuils d'arbitrage poids marketplace (super admin)
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "marketplaceWeightArbitrationMinDiffKg" DECIMAL(14,4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "marketplaceWeightArbitrationCumulativeMinDiffKg" DECIMAL(14,4) NOT NULL DEFAULT 5;

-- Contre-déclaration vendeur et poids par animal (acheteur)
ALTER TABLE "MarketplaceTransaction"
  ADD COLUMN IF NOT EXISTS "sellerDeclaredWeightKg" DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS "sellerWeightDeclaredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "buyerAnimalWeights" JSONB,
  ADD COLUMN IF NOT EXISTS "weightArbitrationRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "weightArbitrationRequestedByUserId" TEXT;

-- Nouveau statut intermédiaire (contre-déclaration vendeur)
ALTER TYPE "MarketplaceTransactionStatus" ADD VALUE IF NOT EXISTS 'WEIGHT_COUNTER_DECLARED';
