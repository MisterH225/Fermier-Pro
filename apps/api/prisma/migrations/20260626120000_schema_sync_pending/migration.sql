-- Alignement schéma Prisma : commissions vendeur/véto, marketplace transaction, nettoyage legacy.

-- DropForeignKey (idempotent)
ALTER TABLE "FarmInvitation" DROP CONSTRAINT IF EXISTS "FarmInvitation_inviteeUserId_fkey";

-- Legacy table remplacée par FarmProfitabilitySnapshot / BatchProfitabilitySnapshot
DROP TABLE IF EXISTS "ProfitabilitySnapshot";

-- DropIndex (idempotent)
DROP INDEX IF EXISTS "FarmExpense_linkedStockMovementIds_idx";
DROP INDEX IF EXISTS "FeedStockMovement_linkedExpenseId_idx";
DROP INDEX IF EXISTS "MarketplaceListing_reservedForBuyerUserId_idx";
DROP INDEX IF EXISTS "UserWalletEntry_vetAppointmentId_idx";

-- PlatformSettings : commissions vendeur et vétérinaire
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "sellerMarketplaceCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS "vetCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05;

UPDATE "PlatformSettings"
SET
  "sellerMarketplaceCommissionRate" = COALESCE("sellerMarketplaceCommissionRate", 0.05),
  "vetCommissionRate" = COALESCE("vetCommissionRate", 0.05);

-- MarketplaceTransaction : commission vendeur
ALTER TABLE "MarketplaceTransaction"
  ADD COLUMN IF NOT EXISTS "buyerPaysCommission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sellerCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sellerCommissionAmount" DECIMAL(14,2);

-- FeedType / PlatformFeatureFlag : @updatedAt sans DEFAULT DB
ALTER TABLE "FeedType" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PlatformFeatureFlag" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- TechnicianProfile : index recherche annuaire
CREATE INDEX IF NOT EXISTS "TechnicianProfile_isPublic_isAvailable_idx"
  ON "TechnicianProfile"("isPublic", "isAvailable");
CREATE INDEX IF NOT EXISTS "TechnicianProfile_locationCity_idx"
  ON "TechnicianProfile"("locationCity");

-- FarmInvitation : FK inviteeUserId ON DELETE SET NULL
ALTER TABLE "FarmInvitation"
  ADD CONSTRAINT "FarmInvitation_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
