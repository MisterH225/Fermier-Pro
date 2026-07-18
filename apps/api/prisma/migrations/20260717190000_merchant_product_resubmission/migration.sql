-- AlterEnum
-- Idempotent : le schéma peut déjà exister (flux `db push` Supabase avant `migrate deploy`).
ALTER TYPE "MerchantProductStatus" ADD VALUE IF NOT EXISTS 'resubmission_review';

-- AlterTable
ALTER TABLE "MerchantProduct" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT,
ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "resubmissionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "resubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantProduct_status_resubmittedAt_idx" ON "MerchantProduct"("status", "resubmittedAt" DESC);
