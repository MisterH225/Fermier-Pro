-- AlterEnum
ALTER TYPE "MerchantProductDisabledReason" ADD VALUE 'shop_archived';

-- AlterTable
ALTER TABLE "MerchantShop" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MerchantShop_merchantProfileId_archivedAt_idx" ON "MerchantShop"("merchantProfileId", "archivedAt");
