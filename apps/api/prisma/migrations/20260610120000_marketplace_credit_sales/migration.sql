-- Vente à crédit marketplace (revendeurs / charcutiers)

CREATE TYPE "OfferType" AS ENUM ('standard', 'credit');
CREATE TYPE "BuyerCreditScore" AS ENUM ('excellent', 'bon', 'nouveau', 'attention', 'risque');
CREATE TYPE "MarketplaceCreditArbitrationResolution" AS ENUM ('paid_late', 'defaulted', 'cancelled');

ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'reserved_credit';

ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'credit_agreed';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'advance_confirmed';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'balance_pending';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'balance_declared';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'arbitration';

ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "offerType" "OfferType" NOT NULL DEFAULT 'standard';
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "advancePercentage" INTEGER;
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "advanceAmount" DECIMAL(14,2);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balanceAmount" DECIMAL(14,2);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balanceDueDays" INTEGER;
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balanceDueAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "advancePaidDeclaredAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "advanceConfirmedAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balancePaidDeclaredAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balanceConfirmedAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "advancePaymentMode" TEXT;
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balancePaymentMode" TEXT;
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "advancePaymentRef" TEXT;
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balancePaymentRef" TEXT;
ALTER TABLE "MarketplaceOffer" ADD COLUMN IF NOT EXISTS "balancePaidAmount" DECIMAL(14,2);

CREATE INDEX IF NOT EXISTS "MarketplaceOffer_offerType_status_idx" ON "MarketplaceOffer"("offerType", "status");

ALTER TABLE "MarketplaceTransaction" ADD COLUMN IF NOT EXISTS "isCredit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "creditScore" "BuyerCreditScore" NOT NULL DEFAULT 'nouveau';
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "creditTransactionsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "creditOnTimeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "creditLateCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "creditDefaultCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "creditBlocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "BuyerProfile_creditScore_idx" ON "BuyerProfile"("creditScore");

CREATE TABLE "MarketplaceCreditArbitration" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "balanceAmount" DECIMAL(14,2) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" "MarketplaceCreditArbitrationResolution",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCreditArbitration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceCreditArbitration_offerId_idx" ON "MarketplaceCreditArbitration"("offerId");
CREATE INDEX "MarketplaceCreditArbitration_listingId_idx" ON "MarketplaceCreditArbitration"("listingId");
CREATE INDEX "MarketplaceCreditArbitration_buyerUserId_idx" ON "MarketplaceCreditArbitration"("buyerUserId");
CREATE INDEX "MarketplaceCreditArbitration_resolvedAt_idx" ON "MarketplaceCreditArbitration"("resolvedAt");

ALTER TABLE "MarketplaceCreditArbitration" ADD CONSTRAINT "MarketplaceCreditArbitration_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "MarketplaceOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCreditArbitration" ADD CONSTRAINT "MarketplaceCreditArbitration_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCreditArbitration" ADD CONSTRAINT "MarketplaceCreditArbitration_buyerUserId_fkey"
    FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCreditArbitration" ADD CONSTRAINT "MarketplaceCreditArbitration_sellerUserId_fkey"
    FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
