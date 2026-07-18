-- AlterEnum
-- Idempotent : le schéma peut déjà exister (flux `db push` Supabase avant `migrate deploy`).
ALTER TYPE "MerchantProductDisabledReason" ADD VALUE IF NOT EXISTS 'shop_archived';

-- AlterTable
ALTER TABLE "MerchantShop" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MerchantShop_merchantProfileId_archivedAt_idx" ON "MerchantShop"("merchantProfileId", "archivedAt");
