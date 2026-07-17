-- AlterEnum
ALTER TYPE "MerchantProductStatus" ADD VALUE 'resubmission_review';

-- AlterTable
ALTER TABLE "MerchantProduct" ADD COLUMN "moderationReason" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "resubmissionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "resubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MerchantProduct_status_resubmittedAt_idx" ON "MerchantProduct"("status", "resubmittedAt" DESC);
