-- Synced to match remote supabase_migrations.schema_migrations version.
-- Required for Supabase Preview / branching history reconciliation.

-- Source mirrored from apps/api/prisma/migrations

-- CreateEnum
CREATE TYPE "MerchantKind" AS ENUM ('standard', 'mill');

-- AlterTable
ALTER TABLE "MerchantProfile" ADD COLUMN "merchantKind" "MerchantKind" NOT NULL DEFAULT 'standard';

-- CreateIndex
CREATE INDEX "MerchantProfile_merchantKind_idx" ON "MerchantProfile"("merchantKind");
