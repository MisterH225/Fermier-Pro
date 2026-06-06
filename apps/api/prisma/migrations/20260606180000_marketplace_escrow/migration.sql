-- Marketplace escrow: transactions, fund movements, platform revenue

CREATE TYPE "MarketplaceTransactionStatus" AS ENUM (
  'OFFER_ACCEPTED',
  'PAYMENT_PENDING',
  'PAYMENT_HELD',
  'PICKUP_SCHEDULED',
  'WEIGHT_DECLARED',
  'WEIGHT_DISPUTED',
  'WEIGHT_VALIDATED',
  'TRANSACTION_CLOSED',
  'CANCELLED_BY_BUYER',
  'CANCELLED_BY_SELLER',
  'CANCELLED_SOLD_TO_OTHER',
  'PAYMENT_FAILED',
  'OFFER_EXPIRED'
);

CREATE TYPE "MarketplacePriceType" AS ENUM ('per_kg', 'flat');
CREATE TYPE "WeightValidatedBy" AS ENUM ('auto', 'seller', 'superadmin');
CREATE TYPE "MarketplaceFundMovementKind" AS ENUM (
  'HOLD',
  'RELEASE_TO_SELLER',
  'REFUND_BUYER',
  'ADDITIONAL_CHARGE',
  'COMMISSION'
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reputationScore" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cancelledAsSellerCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "activeOfferCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MarketplaceTransaction" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "status" "MarketplaceTransactionStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "priceType" "MarketplacePriceType" NOT NULL,
    "agreedPricePerKg" DECIMAL(14,4),
    "agreedFlatPrice" DECIMAL(14,2),
    "estimatedWeightKg" DECIMAL(14,4),
    "blockedAmount" DECIMAL(14,2) NOT NULL,
    "finalAmount" DECIMAL(14,2),
    "realWeightKg" DECIMAL(14,4),
    "arbitrationWeightKg" DECIMAL(14,4),
    "weightDeclaredByBuyerAt" TIMESTAMP(3),
    "weightDisputeOpenedAt" TIMESTAMP(3),
    "weightValidatedAt" TIMESTAMP(3),
    "weightValidatedBy" "WeightValidatedBy",
    "weightScalePhotoUrl" TEXT,
    "pickupDate" DATE,
    "pickupLocation" TEXT,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmount" DECIMAL(14,2),
    "sellerReceivedAmount" DECIMAL(14,2),
    "buyerRefundAmount" DECIMAL(14,2),
    "buyerAdditionalCharge" DECIMAL(14,2),
    "paymentProviderRef" TEXT,
    "paymentInitiatedAt" TIMESTAMP(3),
    "paymentConfirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "offerExpiresAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceTransaction_offerId_key" ON "MarketplaceTransaction"("offerId");
CREATE INDEX "MarketplaceTransaction_listingId_status_idx" ON "MarketplaceTransaction"("listingId", "status");
CREATE INDEX "MarketplaceTransaction_buyerUserId_status_idx" ON "MarketplaceTransaction"("buyerUserId", "status");
CREATE INDEX "MarketplaceTransaction_sellerUserId_status_idx" ON "MarketplaceTransaction"("sellerUserId", "status");
CREATE INDEX "MarketplaceTransaction_status_idx" ON "MarketplaceTransaction"("status");
CREATE INDEX "MarketplaceTransaction_offerExpiresAt_idx" ON "MarketplaceTransaction"("offerExpiresAt");

ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "MarketplaceOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_buyerUserId_fkey"
  FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_sellerUserId_fkey"
  FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MarketplaceFundMovement" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" "MarketplaceFundMovementKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "providerRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceFundMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceFundMovement_transactionId_idx" ON "MarketplaceFundMovement"("transactionId");
ALTER TABLE "MarketplaceFundMovement" ADD CONSTRAINT "MarketplaceFundMovement_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlatformRevenue" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'COMMISSION',
    CONSTRAINT "PlatformRevenue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformRevenue_transactionId_key" ON "PlatformRevenue"("transactionId");
CREATE INDEX "PlatformRevenue_collectedAt_idx" ON "PlatformRevenue"("collectedAt" DESC);
ALTER TABLE "PlatformRevenue" ADD CONSTRAINT "PlatformRevenue_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
