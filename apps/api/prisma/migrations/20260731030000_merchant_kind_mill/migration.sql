-- CreateEnum
CREATE TYPE "MerchantKind" AS ENUM ('standard', 'mill');

-- AlterTable
ALTER TABLE "MerchantProfile" ADD COLUMN "merchantKind" "MerchantKind" NOT NULL DEFAULT 'standard';

-- CreateIndex
CREATE INDEX "MerchantProfile_merchantKind_idx" ON "MerchantProfile"("merchantKind");
