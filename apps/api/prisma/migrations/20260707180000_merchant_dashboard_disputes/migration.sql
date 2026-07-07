-- Merchant dashboard: vues produit, statuts commande litige/terminée, litiges boutique

CREATE TYPE "MerchantOrderDisputeStatus" AS ENUM ('open', 'resolved_seller', 'resolved_buyer', 'closed');

ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE "MerchantOrderStatus" ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE "MerchantProduct" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MerchantOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "MerchantOrderDispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sellerNote" TEXT,
    "buyerNote" TEXT,
    "status" "MerchantOrderDisputeStatus" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantOrderDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantOrderDispute_orderId_key" ON "MerchantOrderDispute"("orderId");
CREATE INDEX IF NOT EXISTS "MerchantOrderDispute_openedByUserId_createdAt_idx" ON "MerchantOrderDispute"("openedByUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MerchantOrderDispute_status_idx" ON "MerchantOrderDispute"("status");

ALTER TABLE "MerchantOrderDispute" DROP CONSTRAINT IF EXISTS "MerchantOrderDispute_orderId_fkey";
ALTER TABLE "MerchantOrderDispute" ADD CONSTRAINT "MerchantOrderDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MerchantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantOrderDispute" DROP CONSTRAINT IF EXISTS "MerchantOrderDispute_openedByUserId_fkey";
ALTER TABLE "MerchantOrderDispute" ADD CONSTRAINT "MerchantOrderDispute_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
