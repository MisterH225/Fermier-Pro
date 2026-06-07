-- ListingStatus: shipped, delivered, disputed
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'disputed';

-- OfferStatus: completed
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'completed';

-- MarketplaceTransactionStatus: delivery confirmation steps
ALTER TYPE "MarketplaceTransactionStatus" ADD VALUE IF NOT EXISTS 'SELLER_SHIPPED';
ALTER TYPE "MarketplaceTransactionStatus" ADD VALUE IF NOT EXISTS 'BUYER_RECEIVED';
ALTER TYPE "MarketplaceTransactionStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_DISPUTED';

-- New enums
CREATE TYPE "MarketplaceDeliveryDisputeStatus" AS ENUM ('open', 'resolved_vendor', 'resolved_buyer', 'resolved_split', 'cancelled');
CREATE TYPE "MarketplaceShipmentMethod" AS ENUM ('handover', 'third_party', 'seller_delivery');
CREATE TYPE "MarketplaceReceiptCondition" AS ENUM ('conform', 'minor_issue', 'major_issue');

-- MarketplaceListing
ALTER TABLE "MarketplaceListing"
ADD COLUMN IF NOT EXISTS "reservedForBuyerUserId" TEXT,
ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);

ALTER TABLE "MarketplaceListing"
ADD CONSTRAINT "MarketplaceListing_reservedForBuyerUserId_fkey"
FOREIGN KEY ("reservedForBuyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MarketplaceListing_reservedForBuyerUserId_idx"
ON "MarketplaceListing"("reservedForBuyerUserId");

-- MarketplaceOffer
ALTER TABLE "MarketplaceOffer"
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- MarketplaceTransaction
ALTER TABLE "MarketplaceTransaction"
ADD COLUMN IF NOT EXISTS "sellerShippedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "shipmentMethod" "MarketplaceShipmentMethod",
ADD COLUMN IF NOT EXISTS "shipmentNotes" TEXT,
ADD COLUMN IF NOT EXISTS "buyerReceivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "receiptCondition" "MarketplaceReceiptCondition",
ADD COLUMN IF NOT EXISTS "receiptNotes" TEXT,
ADD COLUMN IF NOT EXISTS "receivedAnimalIds" JSONB NOT NULL DEFAULT '[]';

-- MarketplaceDeliveryDispute
CREATE TABLE "MarketplaceDeliveryDispute" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "disputeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrls" JSONB NOT NULL DEFAULT '[]',
    "status" "MarketplaceDeliveryDisputeStatus" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceDeliveryDispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceDeliveryDispute_listingId_idx" ON "MarketplaceDeliveryDispute"("listingId");
CREATE INDEX "MarketplaceDeliveryDispute_transactionId_idx" ON "MarketplaceDeliveryDispute"("transactionId");
CREATE INDEX "MarketplaceDeliveryDispute_status_idx" ON "MarketplaceDeliveryDispute"("status");

ALTER TABLE "MarketplaceDeliveryDispute" ADD CONSTRAINT "MarketplaceDeliveryDispute_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceDeliveryDispute" ADD CONSTRAINT "MarketplaceDeliveryDispute_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "MarketplaceOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceDeliveryDispute" ADD CONSTRAINT "MarketplaceDeliveryDispute_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceDeliveryDispute" ADD CONSTRAINT "MarketplaceDeliveryDispute_raisedByUserId_fkey"
FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MarketplacePendingTransfer
CREATE TABLE "MarketplacePendingTransfer" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "buyerFarmId" TEXT,
    "animalIds" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePendingTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplacePendingTransfer_buyerUserId_idx" ON "MarketplacePendingTransfer"("buyerUserId");
CREATE INDEX "MarketplacePendingTransfer_transactionId_idx" ON "MarketplacePendingTransfer"("transactionId");
CREATE INDEX "MarketplacePendingTransfer_expiresAt_idx" ON "MarketplacePendingTransfer"("expiresAt");

ALTER TABLE "MarketplacePendingTransfer" ADD CONSTRAINT "MarketplacePendingTransfer_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplacePendingTransfer" ADD CONSTRAINT "MarketplacePendingTransfer_buyerUserId_fkey"
FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplacePendingTransfer" ADD CONSTRAINT "MarketplacePendingTransfer_buyerFarmId_fkey"
FOREIGN KEY ("buyerFarmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
